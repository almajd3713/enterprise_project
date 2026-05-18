import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone

import requests
from kafka import KafkaConsumer, KafkaProducer
from prometheus_client import Counter, Gauge, Histogram, start_http_server


KAFKA_CONSUME_TOTAL = Counter(
    "dms_translator_kafka_consume_total",
    "Total consumed Kafka messages in translator-service",
    ["topic", "outcome"],
)
TRANSLATE_ATTEMPT_TOTAL = Counter(
    "dms_translator_translate_attempt_total",
    "Total translation attempts by provider/model",
    ["provider", "model", "outcome"],
)
TRANSLATE_DURATION_SECONDS = Histogram(
    "dms_translator_translate_duration_seconds",
    "Translation call duration by provider/model",
    ["provider", "model"],
)
KAFKA_PRODUCE_TOTAL = Counter(
    "dms_translator_kafka_produce_total",
    "Total produced Kafka messages in translator-service",
    ["topic", "outcome"],
)
KAFKA_PRODUCE_DURATION_SECONDS = Histogram(
    "dms_translator_kafka_produce_duration_seconds",
    "Kafka produce duration seconds",
    ["topic"],
)
MESSAGE_PROCESSING_DURATION_SECONDS = Histogram(
    "dms_translator_message_processing_duration_seconds",
    "End-to-end message processing duration in translator-service",
    ["input_topic", "output_topic", "outcome"],
)
IN_FLIGHT_TRANSLATIONS = Gauge(
    "dms_translator_inflight_translations",
    "Current in-flight translations",
)
LAST_SUCCESS_UNIX = Gauge(
    "dms_translator_last_success_unixtime",
    "Unix time for last successful translation",
)


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


def call_google_translate(
    text: str,
    source_language: str,
    target_language: str,
    api_key: str,
    timeout_seconds: int,
) -> str:
    if not api_key:
        raise RuntimeError("GOOGLE_TRANSLATE_API_KEY is not configured")

    url = "https://translation.googleapis.com/language/translate/v2"
    payload = {
        "q": text,
        "source": source_language,
        "target": target_language,
        "format": "text",
    }

    response = requests.post(
        url,
        params={"key": api_key},
        data=payload,
        timeout=timeout_seconds,
    )
    response.raise_for_status()

    body = response.json()
    translated = (
        body.get("data", {})
        .get("translations", [{}])[0]
        .get("translatedText", "")
        .strip()
    )
    if not translated:
        raise RuntimeError(f"Google Translate returned empty translation: {body}")
    return translated


def call_mock_translate(
    text: str,
    source_language: str,
    target_language: str,
) -> str:
    normalized = " ".join(str(text or "").split())
    if not normalized:
        return f"[{target_language.upper()}] (empty)"
    return f"[{target_language.upper()} demo] {normalized}"


def call_libretranslate(
    text: str,
    source_language: str,
    target_language: str,
    base_url: str,
    api_key: str,
    timeout_seconds: int,
) -> str:
    if not base_url:
        raise RuntimeError("LIBRETRANSLATE_URL is not configured")

    url = f"{base_url.rstrip('/')}/translate"
    payload = {
        "q": text,
        "source": source_language,
        "target": target_language,
        "format": "text",
    }
    if api_key:
        payload["api_key"] = api_key

    response = requests.post(
        url,
        json=payload,
        timeout=timeout_seconds,
    )
    response.raise_for_status()

    body = response.json()
    translated = str(body.get("translatedText", "")).strip()
    if not translated:
        raise RuntimeError(f"LibreTranslate returned empty translation: {body}")
    return translated


def translate_with_provider(
    provider: str,
    text: str,
    source_language: str,
    target_language: str,
    timeout_seconds: int,
    gemini_api_key: str,
    gemini_model: str,
    google_translate_api_key: str,
    libretranslate_url: str,
    libretranslate_api_key: str,
) -> tuple[str, str]:
    p = provider.strip().lower()
    if p == "libretranslate":
        translated = call_libretranslate(
            text=text,
            source_language=source_language,
            target_language=target_language,
            base_url=libretranslate_url,
            api_key=libretranslate_api_key,
            timeout_seconds=timeout_seconds,
        )
        return translated, "libretranslate"

    if p == "gemini":
        translated = call_gemini_translate(
            text=text,
            source_language=source_language,
            target_language=target_language,
            api_key=gemini_api_key,
            model=gemini_model,
            timeout_seconds=timeout_seconds,
        )
        return translated, gemini_model

    if p == "google":
        translated = call_google_translate(
            text=text,
            source_language=source_language,
            target_language=target_language,
            api_key=google_translate_api_key,
            timeout_seconds=timeout_seconds,
        )
        return translated, "google-translate-v2"

    if p == "mock":
        translated = call_mock_translate(
            text=text,
            source_language=source_language,
            target_language=target_language,
        )
        return translated, "mock-demo"

    raise RuntimeError(f"Unsupported translation provider: {provider}")


def retry_translate(
    providers: list[str],
    text: str,
    source_language: str,
    target_language: str,
    timeout_seconds: int,
    retries: int,
    retry_backoff_seconds: int,
) -> tuple[str, str, str]:
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = get_env("GEMINI_MODEL", "gemini-2.0-flash")
    google_translate_api_key = os.getenv("GOOGLE_TRANSLATE_API_KEY", "")
    libretranslate_url = get_env("LIBRETRANSLATE_URL", "http://libretranslate:5000")
    libretranslate_api_key = os.getenv("LIBRETRANSLATE_API_KEY", "")

    last_error = None

    for provider in providers:
        for attempt in range(1, retries + 1):
            try:
                started = time.perf_counter()
                translated, model = translate_with_provider(
                    provider=provider,
                    text=text,
                    source_language=source_language,
                    target_language=target_language,
                    timeout_seconds=timeout_seconds,
                    gemini_api_key=gemini_api_key,
                    gemini_model=gemini_model,
                    google_translate_api_key=google_translate_api_key,
                    libretranslate_url=libretranslate_url,
                    libretranslate_api_key=libretranslate_api_key,
                )
                TRANSLATE_DURATION_SECONDS.labels(provider=provider, model=model).observe(
                    time.perf_counter() - started
                )
                TRANSLATE_ATTEMPT_TOTAL.labels(
                    provider=provider, model=model, outcome="success"
                ).inc()
                return translated, provider, model
            except Exception as exc:
                last_error = exc
                TRANSLATE_ATTEMPT_TOTAL.labels(
                    provider=provider, model="unknown", outcome="failure"
                ).inc()
                logging.warning(
                    "Provider=%s failed (attempt %s/%s): %s",
                    provider,
                    attempt,
                    retries,
                    exc,
                )
                if attempt < retries:
                    time.sleep(retry_backoff_seconds)

    raise RuntimeError(f"All providers failed after {retries} attempts each") from last_error


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
    metrics_enabled = get_bool_env("TRANSLATOR_METRICS_ENABLED", True)
    metrics_port = int(get_env("TRANSLATOR_METRICS_PORT", "9108"))

    if metrics_enabled:
        start_http_server(metrics_port)
        logging.info("Prometheus metrics exposed on port=%s", metrics_port)

    providers_raw = get_env("TRANSLATION_PROVIDERS", "libretranslate,google,gemini,mock")
    providers = [p.strip().lower() for p in providers_raw.split(",") if p.strip()]
    if not providers:
        providers = ["mock"]

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
    logging.info("Configured translation providers: %s", ",".join(providers))

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
        IN_FLIGHT_TRANSLATIONS.inc()
        message_started = time.perf_counter()
        payload = message.value or {}
        document_id = payload.get("documentId")
        message_key = message.key or (str(document_id) if document_id is not None else None)
        source_event_id = payload.get("eventId")
        title_to_translate = payload.get("titleToTranslate") or payload.get("title") or ""
        description_to_translate = payload.get("descriptionToTranslate") or payload.get("description") or ""
        event_source_language = payload.get("sourceLanguage") or source_language
        event_target_language = payload.get("targetLanguage") or target_language

        try:
            KAFKA_CONSUME_TOTAL.labels(topic=input_topic, outcome="received").inc()
            translated_title = ""
            translated_description = ""
            used_provider = ""
            used_model = ""

            if str(title_to_translate).strip():
                translated_title, used_provider, used_model = retry_translate(
                    providers=providers,
                    text=title_to_translate,
                    source_language=event_source_language,
                    target_language=event_target_language,
                    timeout_seconds=timeout_seconds,
                    retries=retries,
                    retry_backoff_seconds=retry_backoff_seconds,
                )
            if str(description_to_translate).strip():
                translated_description, used_provider, used_model = retry_translate(
                    providers=providers,
                    text=description_to_translate,
                    source_language=event_source_language,
                    target_language=event_target_language,
                    timeout_seconds=timeout_seconds,
                    retries=retries,
                    retry_backoff_seconds=retry_backoff_seconds,
                )

            translated_event = {
                "eventId": str(uuid.uuid4()),
                "eventType": "DocumentTranslated",
                "occurredAt": utc_now(),
                "sourceService": "translator-service",
                "schemaVersion": "v1",
                "sourceEventId": source_event_id,
                "documentId": document_id,
                "sourceLanguage": event_source_language,
                "targetLanguage": event_target_language,
                # Backward-compatible field (historically title translation).
                "translatedText": translated_title,
                "translatedTitle": translated_title,
                "translatedDescription": translated_description,
                "provider": used_provider,
                "model": used_model,
            }

            produce_started = time.perf_counter()
            producer.send(output_topic, key=message_key, value=translated_event).get(timeout=10)
            producer.flush()
            KAFKA_PRODUCE_DURATION_SECONDS.labels(topic=output_topic).observe(
                time.perf_counter() - produce_started
            )
            KAFKA_PRODUCE_TOTAL.labels(topic=output_topic, outcome="success").inc()

            if not enable_auto_commit:
                consumer.commit()
            KAFKA_CONSUME_TOTAL.labels(topic=input_topic, outcome="success").inc()
            LAST_SUCCESS_UNIX.set_to_current_time()
            MESSAGE_PROCESSING_DURATION_SECONDS.labels(
                input_topic=input_topic, output_topic=output_topic, outcome="success"
            ).observe(time.perf_counter() - message_started)

            logging.info(
                "Translated documentId=%s offset=%s partition=%s",
                document_id,
                message.offset,
                message.partition,
            )
        except Exception as exc:
            KAFKA_CONSUME_TOTAL.labels(topic=input_topic, outcome="failure").inc()
            KAFKA_PRODUCE_TOTAL.labels(topic=output_topic, outcome="failure").inc()
            MESSAGE_PROCESSING_DURATION_SECONDS.labels(
                input_topic=input_topic, output_topic=output_topic, outcome="failure"
            ).observe(time.perf_counter() - message_started)
            # Fail loudly: keep offset uncommitted so the message can be retried.
            logging.exception(
                "Translation failed documentId=%s offset=%s partition=%s: %s",
                document_id,
                message.offset,
                message.partition,
                exc,
            )
        finally:
            IN_FLIGHT_TRANSLATIONS.dec()


if __name__ == "__main__":
    main()
