# translator-service

Python Kafka consumer/producer microservice for Lab 10.

## Responsibilities

- Consume events from `dms.documents.uploaded`
- Call Gemini to translate `textToTranslate`
- Publish translation results to `dms.documents.translated`

## Environment Variables

- `KAFKA_BOOTSTRAP_SERVERS` (default: `localhost:9094`)
- `KAFKA_INPUT_TOPIC` (default: `dms.documents.uploaded`)
- `KAFKA_OUTPUT_TOPIC` (default: `dms.documents.translated`)
- `KAFKA_GROUP_ID` (default: `translator-service`)
- `KAFKA_AUTO_OFFSET_RESET` (default: `earliest`)
- `KAFKA_ENABLE_AUTO_COMMIT` (default: `false`)
- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL` (default: `gemini-2.0-flash`)
- `TRANSLATION_SOURCE_LANGUAGE` (default: `en`)
- `TRANSLATION_TARGET_LANGUAGE` (default: `fr`)
- `TRANSLATION_TIMEOUT_SECONDS` (default: `30`)
- `TRANSLATION_RETRIES` (default: `3`)
- `TRANSLATION_RETRY_BACKOFF_SECONDS` (default: `2`)

## Offset Strategy

By default `KAFKA_ENABLE_AUTO_COMMIT=false`.
The service commits offsets manually only after:

1. Gemini translation succeeds
2. Publish to `dms.documents.translated` succeeds

If translation or publish fails, the offset remains uncommitted.
