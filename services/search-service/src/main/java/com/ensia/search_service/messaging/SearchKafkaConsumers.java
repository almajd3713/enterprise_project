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
    public void onDocumentUploaded(DocumentUploadedEvent event) {
        searchIndexService.upsertFromUpload(event);
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
}
