package com.ensia.documents_service.messaging;

import com.ensia.documents_service.messaging.events.DocumentUploadedEvent;
import com.ensia.documents_service.model.Document;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class DocumentEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String documentsUploadedTopic;
    private final String sourceLanguage;
    private final String targetLanguage;
    private final boolean kafkaEnabled;

    public DocumentEventPublisher(
            KafkaTemplate<String, Object> kafkaTemplate,
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
    }

    public void publishDocumentUploaded(Document document) {
        if (!kafkaEnabled || document.getId() == null) {
            return;
        }

        String textToTranslate = document.getTitle() == null ? "" : document.getTitle();
        DocumentUploadedEvent event = new DocumentUploadedEvent(
                UUID.randomUUID().toString(),
                "DocumentUploaded",
                Instant.now().toString(),
                document.getId(),
                document.getTitle(),
                document.getOwnerId(),
                document.getDepartmentId(),
                document.getCategoryId(),
                document.getFileName(),
                document.getFileKey(),
                document.getContentType(),
                document.getFileSize(),
                sourceLanguage,
                targetLanguage,
                textToTranslate
        );

        kafkaTemplate.send(documentsUploadedTopic, String.valueOf(document.getId()), event);
    }
}
