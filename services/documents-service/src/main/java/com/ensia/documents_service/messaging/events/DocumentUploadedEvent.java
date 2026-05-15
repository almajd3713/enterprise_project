package com.ensia.documents_service.messaging.events;

public record DocumentUploadedEvent(
        String eventId,
        String eventType,
        String occurredAt,
        Long documentId,
        String title,
        String fileName,
        String fileKey,
        String contentType,
        Long fileSize,
        String sourceLanguage,
        String targetLanguage,
        String textToTranslate
) {
}
