package com.ensia.search_service.messaging;

public record DocumentUploadedEvent(
        String eventId,
        String eventType,
        String occurredAt,
        Long documentId,
        String title,
        String ownerId,
        Long departmentId,
        Long categoryId,
        String fileName,
        String fileKey,
        String contentType,
        Long fileSize,
        String sourceLanguage,
        String targetLanguage,
        String textToTranslate
) {
}
