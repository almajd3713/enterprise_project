# translator-service

Python Kafka consumer/producer microservice for Lab 10.

## Responsibilities

- Consume events from `dms.documents.uploaded`
- Translate `textToTranslate` using configurable providers (LibreTranslate / Gemini / Google / Mock)
- Publish translation results to `dms.documents.translated`

## Environment Variables

- `KAFKA_BOOTSTRAP_SERVERS` (default: `localhost:9094`)
- `KAFKA_INPUT_TOPIC` (default: `dms.documents.uploaded`)
- `KAFKA_OUTPUT_TOPIC` (default: `dms.documents.translated`)
- `KAFKA_GROUP_ID` (default: `translator-service`)
- `KAFKA_AUTO_OFFSET_RESET` (default: `earliest`)
- `KAFKA_ENABLE_AUTO_COMMIT` (default: `false`)
- `TRANSLATION_PROVIDERS` (default: `libretranslate,google,gemini,mock`)
- `LIBRETRANSLATE_URL` (default: `http://libretranslate:5000`)
- `LIBRETRANSLATE_API_KEY` (optional)
- `GEMINI_API_KEY` (optional unless `gemini` provider is enabled)
- `GEMINI_MODEL` (default: `gemini-2.0-flash`)
- `GOOGLE_TRANSLATE_API_KEY` (optional unless `google` provider is enabled)
- `TRANSLATION_SOURCE_LANGUAGE` (default: `en`)
- `TRANSLATION_TARGET_LANGUAGE` (default: `fr`)
- `TRANSLATION_TIMEOUT_SECONDS` (default: `30`)
- `TRANSLATION_RETRIES` (default: `3`)
- `TRANSLATION_RETRY_BACKOFF_SECONDS` (default: `2`)

## Offset Strategy

By default `KAFKA_ENABLE_AUTO_COMMIT=false`.
The service commits offsets manually only after:

1. Translation succeeds with one configured provider
2. Publish to `dms.documents.translated` succeeds

If translation or publish fails, the offset remains uncommitted.

## Provider Behavior

Providers are attempted in the order defined by `TRANSLATION_PROVIDERS`.

- `gemini`: Google Gemini generation API
- `google`: Google Translate API v2 (`translation.googleapis.com`)
- `libretranslate`: LibreTranslate REST API (self-hosted or managed endpoint)
- `mock`: deterministic demo translation fallback

The output event includes:

- `provider`: selected provider name
- `model`: provider model/identifier (e.g. `libretranslate`, `gemini-2.0-flash`, `google-translate-v2`, `mock-demo`)
