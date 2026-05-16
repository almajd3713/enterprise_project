package com.ensia.search_service.messaging;

import com.ensia.search_service.service.SearchIndexService;
import java.util.Map;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class SearchKafkaConsumers {

    private final SearchIndexService searchIndexService;

    public SearchKafkaConsumers(SearchIndexService searchIndexService) {
        this.searchIndexService = searchIndexService;
    }

    @KafkaListener(topics = "${app.kafka.topics.documents-uploaded}", groupId = "${spring.kafka.consumer.group-id}")
    public void onDocumentUploaded(Map<String, Object> event) {
        DocumentUploadedEvent mapped = mapUploadedEvent(event);
        searchIndexService.upsertFromUpload(mapped);
    }

    @KafkaListener(topics = "${app.kafka.topics.documents-translated}", groupId = "${spring.kafka.consumer.group-id}")
    public void onDocumentTranslated(Map<String, Object> event) {
        Object rawId = event.get("documentId");
        Object rawText = event.get("translatedText");
        if (!(rawId instanceof Number) || rawText == null) {
            return;
        }
        searchIndexService.applyTranslation(((Number) rawId).longValue(), rawText.toString());
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
                asString(event.get("ownerId")),
                asLong(event.get("departmentId")),
                asLong(event.get("categoryId")),
                asString(event.get("fileName")),
                asString(event.get("fileKey")),
                asString(event.get("contentType")),
                asLong(event.get("fileSize")),
                asString(event.get("sourceLanguage")),
                asString(event.get("targetLanguage")),
                asString(event.get("textToTranslate"))
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
}
