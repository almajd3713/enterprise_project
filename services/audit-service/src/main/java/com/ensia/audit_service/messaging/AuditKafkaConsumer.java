package com.ensia.audit_service.messaging;

import com.ensia.audit_service.service.AuditEventService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class AuditKafkaConsumer {

    private final AuditEventService auditEventService;
    private final Counter consumeReceived;
    private final Counter consumeSuccess;
    private final Counter consumeInvalid;
    private final Counter consumeFailure;
    private final Timer consumeLatency;
    private final DistributionSummary payloadSizeBytes;

    public AuditKafkaConsumer(AuditEventService auditEventService, MeterRegistry meterRegistry) {
        this.auditEventService = auditEventService;
        this.consumeReceived = counter(meterRegistry, "received");
        this.consumeSuccess = counter(meterRegistry, "success");
        this.consumeInvalid = counter(meterRegistry, "invalid");
        this.consumeFailure = counter(meterRegistry, "failure");
        this.consumeLatency = Timer.builder("dms_kafka_consume_latency_seconds")
                .tag("service", "audit-service")
                .tag("topic", "dms.audit.events")
                .register(meterRegistry);
        this.payloadSizeBytes = DistributionSummary.builder("dms_kafka_payload_size_bytes")
                .tag("service", "audit-service")
                .tag("topic", "dms.audit.events")
                .tag("direction", "consume")
                .baseUnit("bytes")
                .register(meterRegistry);
    }

    @KafkaListener(topics = "${app.audit.topic}", groupId = "${spring.kafka.consumer.group-id}")
    public void consume(AuditEventMessage message) {
        long started = System.nanoTime();
        consumeReceived.increment();
        payloadSizeBytes.record(message == null ? 0 : message.toString().length());
        try {
            if (message == null) {
                consumeInvalid.increment();
                return;
            }
            auditEventService.append(message);
            consumeSuccess.increment();
        } catch (RuntimeException ex) {
            consumeFailure.increment();
            throw ex;
        } finally {
            consumeLatency.record(System.nanoTime() - started, java.util.concurrent.TimeUnit.NANOSECONDS);
        }
    }

    private Counter counter(MeterRegistry meterRegistry, String outcome) {
        return Counter.builder("dms_kafka_messages_total")
                .tag("service", "audit-service")
                .tag("topic", "dms.audit.events")
                .tag("direction", "consume")
                .tag("outcome", outcome)
                .register(meterRegistry);
    }
}
