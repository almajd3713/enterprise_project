package com.ensia.audit_service.messaging;

import com.ensia.audit_service.service.AuditEventService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class AuditKafkaConsumer {

    private final AuditEventService auditEventService;

    public AuditKafkaConsumer(AuditEventService auditEventService) {
        this.auditEventService = auditEventService;
    }

    @KafkaListener(topics = "${app.audit.topic}", groupId = "${spring.kafka.consumer.group-id}")
    public void consume(AuditEventMessage message) {
        if (message == null) {
            return;
        }
        auditEventService.append(message);
    }
}
