package com.ensia.search_service.messaging;

import com.ensia.search_service.service.SearchIndexService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.Map;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class SearchKafkaConsumers {

    private final SearchIndexService searchIndexService;
    private final Counter uploadedReceived;
    private final Counter uploadedSuccess;
    private final Counter uploadedInvalid;
    private final Counter translatedReceived;
    private final Counter translatedSuccess;
    private final Counter translatedInvalid;
    private final Counter consumeFailure;
    private final Timer uploadedLatency;
    private final Timer translatedLatency;
    private final DistributionSummary payloadSizeBytes;

    public SearchKafkaConsumers(SearchIndexService searchIndexService, MeterRegistry meterRegistry) {
        this.searchIndexService = searchIndexService;
        this.uploadedReceived = counter(meterRegistry, "dms.documents.uploaded", "received");
        this.uploadedSuccess = counter(meterRegistry, "dms.documents.uploaded", "success");
        this.uploadedInvalid = counter(meterRegistry, "dms.documents.uploaded", "invalid");
        this.translatedReceived = counter(meterRegistry, "dms.documents.translated", "received");
        this.translatedSuccess = counter(meterRegistry, "dms.documents.translated", "success");
        this.translatedInvalid = counter(meterRegistry, "dms.documents.translated", "invalid");
        this.consumeFailure = Counter.builder("dms_kafka_messages_total")
                .tag("service", "search-service")
                .tag("topic", "all")
                .tag("direction", "consume")
                .tag("outcome", "failure")
                .register(meterRegistry);
        this.uploadedLatency = Timer.builder("dms_kafka_consume_latency_seconds")
                .tag("service", "search-service")
                .tag("topic", "dms.documents.uploaded")
                .register(meterRegistry);
        this.translatedLatency = Timer.builder("dms_kafka_consume_latency_seconds")
                .tag("service", "search-service")
                .tag("topic", "dms.documents.translated")
                .register(meterRegistry);
        this.payloadSizeBytes = DistributionSummary.builder("dms_kafka_payload_size_bytes")
                .tag("service", "search-service")
                .tag("direction", "consume")
                .baseUnit("bytes")
                .register(meterRegistry);
    }

    @KafkaListener(topics = "${app.kafka.topics.documents-uploaded}", groupId = "${spring.kafka.consumer.group-id}")
    public void onDocumentUploaded(Map<String, Object> event) {
        long started = System.nanoTime();
        uploadedReceived.increment();
        payloadSizeBytes.record(event == null ? 0 : event.toString().length());
        try {
            DocumentUploadedEvent mapped = mapUploadedEvent(event);
            if (mapped == null || mapped.documentId() == null) {
                uploadedInvalid.increment();
                return;
            }
            searchIndexService.upsertFromUpload(mapped);
            uploadedSuccess.increment();
        } catch (RuntimeException ex) {
            consumeFailure.increment();
            throw ex;
        } finally {
            uploadedLatency.record(System.nanoTime() - started, java.util.concurrent.TimeUnit.NANOSECONDS);
        }
    }

    @KafkaListener(topics = "${app.kafka.topics.documents-translated}", groupId = "${spring.kafka.consumer.group-id}")
    public void onDocumentTranslated(Map<String, Object> event) {
        long started = System.nanoTime();
        translatedReceived.increment();
        payloadSizeBytes.record(event == null ? 0 : event.toString().length());
        try {
            if (event == null) {
                translatedInvalid.increment();
                return;
            }
            Object rawId = event.get("documentId");
            Object rawText = event.get("translatedText");
            Object rawDescription = event.get("translatedDescription");
            if (!(rawId instanceof Number) || rawText == null) {
                translatedInvalid.increment();
                return;
            }
            searchIndexService.applyTranslation(
                    ((Number) rawId).longValue(),
                    rawText.toString(),
                    rawDescription == null ? null : rawDescription.toString()
            );
            translatedSuccess.increment();
        } catch (RuntimeException ex) {
            consumeFailure.increment();
            throw ex;
        } finally {
            translatedLatency.record(System.nanoTime() - started, java.util.concurrent.TimeUnit.NANOSECONDS);
        }
    }

    private DocumentUploadedEvent mapUploadedEvent(Map<String, Object> event) {
        if (event == null) {
            return null;
        }
        return new DocumentUploadedEvent(
                asString(event.get("eventId")),
                asString(event.get("eventType")),
                asString(event.get("occurredAt")),
                asLong(event.get("documentId")),
                asString(event.get("title")),
                asString(event.get("description")),
                asString(event.get("ownerId")),
                asLong(event.get("departmentId")),
                asLong(event.get("categoryId")),
                asString(event.get("fileName")),
                asString(event.get("fileKey")),
                asString(event.get("contentType")),
                asLong(event.get("fileSize")),
                asString(event.get("sourceLanguage")),
                asString(event.get("targetLanguage")),
                asString(event.get("textToTranslate")),
                asString(event.get("titleToTranslate")),
                asString(event.get("descriptionToTranslate"))
        );
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Counter counter(MeterRegistry meterRegistry, String topic, String outcome) {
        return Counter.builder("dms_kafka_messages_total")
                .tag("service", "search-service")
                .tag("topic", topic)
                .tag("direction", "consume")
                .tag("outcome", outcome)
                .register(meterRegistry);
    }
}
