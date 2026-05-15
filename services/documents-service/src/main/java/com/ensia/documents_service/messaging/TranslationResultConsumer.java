package com.ensia.documents_service.messaging;

import com.ensia.documents_service.repository.DocumentRepository;
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

    public TranslationResultConsumer(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    @KafkaListener(
            topics = "${app.kafka.topics.documents-translated}",
            groupId = "${app.kafka.consumer.group-id}",
            containerFactory = "translationKafkaListenerContainerFactory"
    )
    public void onTranslated(@Payload Map<String, Object> event, Acknowledgment acknowledgment) {
        Object rawId = event.get("documentId");
        Object rawText = event.get("translatedText");

        if (rawId == null || rawText == null) {
            log.warn("Received incomplete translation event — skipping: {}", event);
            acknowledgment.acknowledge();
            return;
        }

        Long documentId;
        try {
            documentId = ((Number) rawId).longValue();
        } catch (ClassCastException e) {
            log.warn("documentId is not a number in translation event: {}", rawId);
            acknowledgment.acknowledge();
            return;
        }

        String translatedText = rawText.toString();

        documentRepository.findById(documentId).ifPresentOrElse(
                doc -> {
                    doc.setTranslatedText(translatedText);
                    documentRepository.save(doc);
                    log.info("Persisted translatedText for documentId={} ({} chars)",
                            documentId, translatedText.length());
                    acknowledgment.acknowledge();
                },
                () -> {
                    log.warn("Received translation for unknown documentId={} — ignoring", documentId);
                    // Still commit so we don't loop forever on a deleted document
                    acknowledgment.acknowledge();
                }
        );
    }
}
