package com.ensia.auth_service.audit;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import java.util.concurrent.TimeUnit;

@Component
public class AuditEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String topic;
    private final Counter produceAttempts;
    private final Counter produceSuccess;
    private final Counter produceFailure;
    private final Timer produceLatency;
    private final DistributionSummary payloadSizeBytes;

    public AuditEventPublisher(KafkaTemplate<String, Object> kafkaTemplate,
                               MeterRegistry meterRegistry,
                               @Value("${app.audit.topic}") String topic) {
        this.kafkaTemplate = kafkaTemplate;
        this.topic = topic;
        this.produceAttempts = Counter.builder("dms_kafka_messages_total")
                .tag("service", "auth-service").tag("topic", "dms.audit.events")
                .tag("direction", "produce").tag("outcome", "attempt")
                .register(meterRegistry);
        this.produceSuccess = Counter.builder("dms_kafka_messages_total")
                .tag("service", "auth-service").tag("topic", "dms.audit.events")
                .tag("direction", "produce").tag("outcome", "success")
                .register(meterRegistry);
        this.produceFailure = Counter.builder("dms_kafka_messages_total")
                .tag("service", "auth-service").tag("topic", "dms.audit.events")
                .tag("direction", "produce").tag("outcome", "failure")
                .register(meterRegistry);
        this.produceLatency = Timer.builder("dms_kafka_publish_latency_seconds")
                .tag("service", "auth-service").tag("topic", "dms.audit.events")
                .register(meterRegistry);
        this.payloadSizeBytes = DistributionSummary.builder("dms_kafka_payload_size_bytes")
                .tag("service", "auth-service").tag("topic", "dms.audit.events")
                .tag("direction", "produce").baseUnit("bytes")
                .register(meterRegistry);
    }

    public void publish(String actor, String action, String resourceType, String resourceId, Map<String, Object> metadata) {
        produceAttempts.increment();
        long started = System.nanoTime();
        Map<String, Object> event = new HashMap<>();
        event.put("eventId", UUID.randomUUID().toString());
        event.put("eventType", "AuditEvent");
        event.put("occurredAt", Instant.now().toString());
        event.put("sourceService", "auth-service");
        event.put("schemaVersion", "v1");
        event.put("actor", actor == null ? "unknown" : actor);
        event.put("action", action);
        event.put("resourceType", resourceType);
        event.put("resourceId", resourceId);
        event.put("metadata", metadata == null ? Map.of() : metadata);
        payloadSizeBytes.record(event.toString().length());
        kafkaTemplate.send(topic, UUID.randomUUID().toString(), event).whenComplete((result, ex) -> {
            produceLatency.record(System.nanoTime() - started, TimeUnit.NANOSECONDS);
            if (ex == null) {
                produceSuccess.increment();
            } else {
                produceFailure.increment();
            }
        });
    }
}
