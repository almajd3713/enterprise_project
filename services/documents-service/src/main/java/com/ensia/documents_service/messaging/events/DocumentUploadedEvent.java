package com.ensia.documents_service.messaging.events;

public record DocumentUploadedEvent(
        String eventId,
        String eventType,
        String occurredAt,
        Long documentId,
        String title,
        String description,
        String ownerId,
        Long departmentId,
        Long categoryId,
        String fileName,
        String fileKey,
        String contentType,
        Long fileSize,
        String sourceLanguage,
        String targetLanguage,
        String textToTranslate,
        String titleToTranslate,
        String descriptionToTranslate
) {
}
