package com.ensia.comments_service.audit;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
public class AuditEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String topic;

    public AuditEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
                               @Value("${app.audit.topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
    }

    public void publish(String actor, String action, String resourceType, String resourceId, Map<String, Object> metadata) {
        Map<String, Object> event = new HashMap<>();
        event.put("eventId", UUID.randomUUID().toString());
        event.put("occurredAt", Instant.now().toString());
        event.put("actor", actor == null ? "unknown" : actor);
        event.put("action", action);
        event.put("resourceType", resourceType);
        event.put("resourceId", resourceId);
        event.put("metadata", metadata == null ? Map.of() : metadata);
        kafkaTemplate.send(topic, UUID.randomUUID().toString(), event);
    }
}
