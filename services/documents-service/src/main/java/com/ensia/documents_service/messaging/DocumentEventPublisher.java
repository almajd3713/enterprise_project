package com.ensia.documents_service.messaging;

import com.ensia.documents_service.messaging.events.DocumentUploadedEvent;
import com.ensia.documents_service.model.Document;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class DocumentEventPublisher {
    private static final String TOPIC_TAG = "dms.documents.uploaded";

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String documentsUploadedTopic;
    private final String sourceLanguage;
    private final String targetLanguage;
    private final boolean kafkaEnabled;
    private final Counter produceAttempts;
    private final Counter produceSuccess;
    private final Counter produceFailure;
    private final Counter produceSkipped;
    private final Timer produceLatency;
    private final DistributionSummary payloadSizeBytes;

    public DocumentEventPublisher(
            KafkaTemplate<String, Object> kafkaTemplate,
            MeterRegistry meterRegistry,
            @Value("${app.kafka.topics.documents-uploaded}") String documentsUploadedTopic,
            @Value("${app.kafka.translation.source-language}") String sourceLanguage,
            @Value("${app.kafka.translation.target-language}") String targetLanguage,
            @Value("${app.kafka.enabled:true}") boolean kafkaEnabled
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.documentsUploadedTopic = documentsUploadedTopic;
        this.sourceLanguage = sourceLanguage;
        this.targetLanguage = targetLanguage;
        this.kafkaEnabled = kafkaEnabled;
        this.produceAttempts = Counter.builder("dms_kafka_messages_total")
                .tag("service", "documents-service")
                .tag("topic", TOPIC_TAG)
                .tag("direction", "produce")
                .tag("outcome", "attempt")
                .register(meterRegistry);
        this.produceSuccess = Counter.builder("dms_kafka_messages_total")
                .tag("service", "documents-service")
                .tag("topic", TOPIC_TAG)
                .tag("direction", "produce")
                .tag("outcome", "success")
                .register(meterRegistry);
        this.produceFailure = Counter.builder("dms_kafka_messages_total")
                .tag("service", "documents-service")
                .tag("topic", TOPIC_TAG)
                .tag("direction", "produce")
                .tag("outcome", "failure")
                .register(meterRegistry);
        this.produceSkipped = Counter.builder("dms_kafka_messages_total")
                .tag("service", "documents-service")
                .tag("topic", TOPIC_TAG)
                .tag("direction", "produce")
                .tag("outcome", "skipped")
                .register(meterRegistry);
        this.produceLatency = Timer.builder("dms_kafka_publish_latency_seconds")
                .tag("service", "documents-service")
                .tag("topic", TOPIC_TAG)
                .register(meterRegistry);
        this.payloadSizeBytes = DistributionSummary.builder("dms_kafka_payload_size_bytes")
                .tag("service", "documents-service")
                .tag("topic", TOPIC_TAG)
                .tag("direction", "produce")
                .baseUnit("bytes")
                .register(meterRegistry);
    }

    public void publishDocumentUploaded(Document document) {
        if (!kafkaEnabled || document.getId() == null) {
            produceSkipped.increment();
            return;
        }
        produceAttempts.increment();
        long started = System.nanoTime();

        String titleToTranslate = document.getTitle() == null ? "" : document.getTitle();
        String descriptionToTranslate = document.getDescription() == null ? "" : document.getDescription();
        DocumentUploadedEvent event = new DocumentUploadedEvent(
                UUID.randomUUID().toString(),
                "DocumentUploaded",
                Instant.now().toString(),
                document.getId(),
                document.getTitle(),
                document.getDescription(),
                document.getOwnerId(),
                document.getDepartmentId(),
                document.getCategoryId(),
                document.getFileName(),
                document.getFileKey(),
                document.getContentType(),
                document.getFileSize(),
                sourceLanguage,
                targetLanguage,
                titleToTranslate,
                titleToTranslate,
                descriptionToTranslate
        );

        Map<String, Object> envelope = new HashMap<>();
        envelope.put("eventId", event.eventId());
        envelope.put("eventType", event.eventType());
        envelope.put("occurredAt", event.occurredAt());
        envelope.put("sourceService", "documents-service");
        envelope.put("schemaVersion", "v1");
        envelope.put("documentId", event.documentId());
        envelope.put("title", event.title());
        envelope.put("description", event.description());
        envelope.put("ownerId", event.ownerId());
        envelope.put("departmentId", event.departmentId());
        envelope.put("categoryId", event.categoryId());
        envelope.put("fileName", event.fileName());
        envelope.put("fileKey", event.fileKey());
        envelope.put("contentType", event.contentType());
        envelope.put("fileSize", event.fileSize());
        envelope.put("sourceLanguage", event.sourceLanguage());
        envelope.put("targetLanguage", event.targetLanguage());
        envelope.put("textToTranslate", event.textToTranslate());
        envelope.put("titleToTranslate", event.titleToTranslate());
        envelope.put("descriptionToTranslate", event.descriptionToTranslate());
        payloadSizeBytes.record(envelope.toString().length());

        kafkaTemplate.send(documentsUploadedTopic, String.valueOf(document.getId()), envelope)
                .whenComplete((result, ex) -> {
                    produceLatency.record(System.nanoTime() - started, TimeUnit.NANOSECONDS);
                    if (ex == null) {
                        produceSuccess.increment();
                    } else {
                        produceFailure.increment();
                    }
                });
    }
}
