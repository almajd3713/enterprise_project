import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import requests
from kafka import KafkaConsumer, KafkaProducer


def get_env(name: str, default: str) -> str:
    return os.getenv(name, default).strip()


def get_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def call_gemini_translate(
    text: str,
    source_language: str,
    target_language: str,
    api_key: str,
    model: str,
    timeout_seconds: int,
) -> str:
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    prompt = (
        f"Translate the following text from {source_language} to {target_language}. "
        "Return only the translated text with no explanation.\n\n"
        f"Text:\n{text}"
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ]
    }

    response = requests.post(
        url,
        params={"key": api_key},
        json=payload,
        timeout=timeout_seconds,
    )
    response.raise_for_status()

    body = response.json()
    candidates = body.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {body}")

    parts = candidates[0].get("content", {}).get("parts", [])
    translated = "".join(part.get("text", "") for part in parts).strip()
    if not translated:
        raise RuntimeError(f"Gemini returned empty translation: {body}")

    return translated


def retry_translate(
    text: str,
    source_language: str,
    target_language: str,
    api_key: str,
    model: str,
    timeout_seconds: int,
    retries: int,
    retry_backoff_seconds: int,
) -> str:
    last_error = None

    for attempt in range(1, retries + 1):
        try:
            return call_gemini_translate(
                text=text,
                source_language=source_language,
                target_language=target_language,
                api_key=api_key,
                model=model,
                timeout_seconds=timeout_seconds,
            )
        except Exception as exc:
            last_error = exc
            logging.warning(
                "Gemini call failed (attempt %s/%s): %s",
                attempt,
                retries,
                exc,
            )
            if attempt < retries:
                time.sleep(retry_backoff_seconds)

    raise RuntimeError(f"Gemini call failed after {retries} attempts") from last_error


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    bootstrap_servers = get_env("KAFKA_BOOTSTRAP_SERVERS", "localhost:9094")
    input_topic = get_env("KAFKA_INPUT_TOPIC", "dms.documents.uploaded")
    output_topic = get_env("KAFKA_OUTPUT_TOPIC", "dms.documents.translated")
    group_id = get_env("KAFKA_GROUP_ID", "translator-service")
    auto_offset_reset = get_env("KAFKA_AUTO_OFFSET_RESET", "earliest")
    enable_auto_commit = get_bool_env("KAFKA_ENABLE_AUTO_COMMIT", False)

    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = get_env("GEMINI_MODEL", "gemini-2.0-flash")

    source_language = get_env("TRANSLATION_SOURCE_LANGUAGE", "en")
    target_language = get_env("TRANSLATION_TARGET_LANGUAGE", "fr")
    timeout_seconds = int(get_env("TRANSLATION_TIMEOUT_SECONDS", "30"))
    retries = int(get_env("TRANSLATION_RETRIES", "3"))
    retry_backoff_seconds = int(get_env("TRANSLATION_RETRY_BACKOFF_SECONDS", "2"))

    logging.info(
        "Starting translator-service group=%s input=%s output=%s auto_commit=%s auto_offset_reset=%s",
        group_id,
        input_topic,
        output_topic,
        enable_auto_commit,
        auto_offset_reset,
    )

    consumer = KafkaConsumer(
        input_topic,
        bootstrap_servers=bootstrap_servers,
        group_id=group_id,
        auto_offset_reset=auto_offset_reset,
        enable_auto_commit=enable_auto_commit,
        key_deserializer=lambda value: value.decode("utf-8") if value else None,
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
    )

    producer = KafkaProducer(
        bootstrap_servers=bootstrap_servers,
        key_serializer=lambda value: value.encode("utf-8") if value else None,
        value_serializer=lambda value: json.dumps(value).encode("utf-8"),
    )

    for message in consumer:
        payload = message.value or {}
        document_id = payload.get("documentId")
        message_key = message.key or (str(document_id) if document_id is not None else None)
        source_event_id = payload.get("eventId")
        text_to_translate = payload.get("textToTranslate") or payload.get("title") or ""
        event_source_language = payload.get("sourceLanguage") or source_language
        event_target_language = payload.get("targetLanguage") or target_language

        try:
            translated_text = retry_translate(
                text=text_to_translate,
                source_language=event_source_language,
                target_language=event_target_language,
                api_key=gemini_api_key,
                model=gemini_model,
                timeout_seconds=timeout_seconds,
                retries=retries,
                retry_backoff_seconds=retry_backoff_seconds,
            )

            translated_event = {
                "eventId": str(uuid.uuid4()),
                "eventType": "DocumentTranslated",
                "occurredAt": utc_now(),
                "sourceEventId": source_event_id,
                "documentId": document_id,
                "sourceLanguage": event_source_language,
                "targetLanguage": event_target_language,
                "translatedText": translated_text,
                "model": gemini_model,
            }

            producer.send(output_topic, key=message_key, value=translated_event).get(timeout=10)
            producer.flush()

            if not enable_auto_commit:
                consumer.commit()

            logging.info(
                "Translated documentId=%s offset=%s partition=%s",
                document_id,
                message.offset,
                message.partition,
            )
        except Exception as exc:
            # Fail loudly: keep offset uncommitted so the message can be retried.
            logging.exception(
                "Translation failed documentId=%s offset=%s partition=%s: %s",
                document_id,
                message.offset,
                message.partition,
                exc,
            )


if __name__ == "__main__":
    main()
