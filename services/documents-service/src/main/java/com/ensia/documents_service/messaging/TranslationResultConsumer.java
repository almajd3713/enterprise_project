package com.ensia.documents_service.messaging;

import com.ensia.documents_service.repository.DocumentRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Consumes {@code DocumentTranslated} events from {@code dms.documents.translated}
 * and persists the translated text back into the Document row in Postgres.
 *
 * <p>Architectural note: the translator-service is intentionally not allowed to call
 * the Documents service directly.  Writing the result back here (inside the DMS) keeps
 * all persistence concerns inside the service that owns the data.</p>
 */
@Component
public class TranslationResultConsumer {

    private static final Logger log = LoggerFactory.getLogger(TranslationResultConsumer.class);

    private final DocumentRepository documentRepository;
    private final Counter consumeReceived;
    private final Counter consumeInvalid;
    private final Counter consumeSuccess;
    private final Counter consumeFailure;
    private final Counter ackSuccess;
    private final Timer processingLatency;
    private final DistributionSummary payloadSizeBytes;
    private final DistributionSummary translatedTitleLength;
    private final DistributionSummary translatedDescriptionLength;

    public TranslationResultConsumer(DocumentRepository documentRepository, MeterRegistry meterRegistry) {
        this.documentRepository = documentRepository;
        this.consumeReceived = buildCounter(meterRegistry, "received");
        this.consumeInvalid = buildCounter(meterRegistry, "invalid");
        this.consumeSuccess = buildCounter(meterRegistry, "success");
        this.consumeFailure = buildCounter(meterRegistry, "failure");
        this.ackSuccess = buildCounter(meterRegistry, "ack_success");
        this.processingLatency = Timer.builder("dms_kafka_consume_latency_seconds")
                .tag("service", "documents-service")
                .tag("topic", "dms.documents.translated")
                .register(meterRegistry);
        this.payloadSizeBytes = DistributionSummary.builder("dms_kafka_payload_size_bytes")
                .tag("service", "documents-service")
                .tag("topic", "dms.documents.translated")
                .tag("direction", "consume")
                .baseUnit("bytes")
                .register(meterRegistry);
        this.translatedTitleLength = DistributionSummary.builder("dms_translation_text_length")
                .tag("service", "documents-service")
                .tag("field", "title")
                .register(meterRegistry);
        this.translatedDescriptionLength = DistributionSummary.builder("dms_translation_text_length")
                .tag("service", "documents-service")
                .tag("field", "description")
                .register(meterRegistry);
    }

    @KafkaListener(
            topics = "${app.kafka.topics.documents-translated}",
            groupId = "${app.kafka.consumer.group-id}",
            containerFactory = "translationKafkaListenerContainerFactory"
    )
    public void onTranslated(@Payload Map<String, Object> event, Acknowledgment acknowledgment) {
        long sample = System.nanoTime();
        consumeReceived.increment();
        payloadSizeBytes.record(event == null ? 0 : event.toString().length());
        if (event == null) {
            consumeInvalid.increment();
            acknowledgment.acknowledge();
            ackSuccess.increment();
            processingLatency.record(System.nanoTime() - sample, java.util.concurrent.TimeUnit.NANOSECONDS);
            return;
        }
        Object rawId = event.get("documentId");
        Object rawText = event.get("translatedText");
        Object rawDescription = event.get("translatedDescription");

        if (rawId == null || rawText == null) {
            log.warn("Received incomplete translation event — skipping: {}", event);
            consumeInvalid.increment();
            acknowledgment.acknowledge();
            ackSuccess.increment();
            processingLatency.record(System.nanoTime() - sample, java.util.concurrent.TimeUnit.NANOSECONDS);
            return;
        }

        Long documentId;
        try {
            documentId = ((Number) rawId).longValue();
        } catch (ClassCastException e) {
            log.warn("documentId is not a number in translation event: {}", rawId);
            consumeInvalid.increment();
            acknowledgment.acknowledge();
            ackSuccess.increment();
            processingLatency.record(System.nanoTime() - sample, java.util.concurrent.TimeUnit.NANOSECONDS);
            return;
        }

        String translatedText = rawText.toString();
        String translatedDescription = rawDescription == null ? null : rawDescription.toString();
        translatedTitleLength.record(translatedText.length());
        translatedDescriptionLength.record(translatedDescription == null ? 0 : translatedDescription.length());

        try {
            documentRepository.findById(documentId).ifPresentOrElse(
                    doc -> {
                        doc.setTranslatedText(translatedText);
                        doc.setTranslatedDescription(translatedDescription);
                        documentRepository.save(doc);
                        log.info("Persisted translatedText for documentId={} ({} chars)",
                                documentId, translatedText.length());
                    },
                    () -> log.warn("Received translation for unknown documentId={} — ignoring", documentId)
            );
            consumeSuccess.increment();
        } catch (RuntimeException ex) {
            consumeFailure.increment();
            throw ex;
        } finally {
            // Still commit so we don't loop forever on a deleted document
            acknowledgment.acknowledge();
            ackSuccess.increment();
            processingLatency.record(System.nanoTime() - sample, java.util.concurrent.TimeUnit.NANOSECONDS);
        }
    }

    private Counter buildCounter(MeterRegistry meterRegistry, String outcome) {
        return Counter.builder("dms_kafka_messages_total")
                .tag("service", "documents-service")
                .tag("topic", "dms.documents.translated")
                .tag("direction", "consume")
                .tag("outcome", outcome)
                .register(meterRegistry);
    }
}
