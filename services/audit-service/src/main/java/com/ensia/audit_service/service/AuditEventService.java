package com.ensia.audit_service.service;

import com.ensia.audit_service.messaging.AuditEventMessage;
import com.ensia.audit_service.model.AuditEvent;
import com.ensia.audit_service.repository.AuditEventRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditEventService {

    private static final String GENESIS_HASH = "GENESIS";

    private final AuditEventRepository repository;
    private final AuditHasher hasher;

    public AuditEventService(AuditEventRepository repository, AuditHasher hasher) {
        this.repository = repository;
        this.hasher = hasher;
    }

    @Transactional
    public AuditEvent append(AuditEventMessage message) {
        String previousHash = repository.findTopByOrderByIdDesc()
                .map(AuditEvent::getEventHash)
                .orElse(GENESIS_HASH);

        AuditEvent event = new AuditEvent();
        event.setEventId(message.getEventId() == null || message.getEventId().isBlank() ? UUID.randomUUID().toString() : message.getEventId());
        if (message.getOccurredAt() == null || message.getOccurredAt().isBlank()) {
            event.setOccurredAt(Instant.now());
        } else {
            try {
                event.setOccurredAt(Instant.parse(message.getOccurredAt()));
            } catch (RuntimeException ex) {
                event.setOccurredAt(Instant.now());
            }
        }
        event.setActor(safe(message.getActor(), "unknown"));
        event.setAction(safe(message.getAction(), "UNKNOWN"));
        event.setResourceType(safe(message.getResourceType(), "Unknown"));
        event.setResourceId(message.getResourceId());
        event.setDepartmentId(message.getDepartmentId());
        event.setTraceId(message.getTraceId());

        event.setMetadataJson(String.valueOf(message.getMetadata() == null ? Map.of() : message.getMetadata()));
        event.setPreviousHash(previousHash);

        String canonicalPayload = canonicalPayload(event);
        event.setEventHash(hasher.hash(canonicalPayload + "|" + previousHash));

        return repository.save(event);
    }

    @Transactional(readOnly = true)
    public List<AuditEvent> list() {
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> integrityReport() {
        List<AuditEvent> events = repository.findAll();
        String previousHash = GENESIS_HASH;
        int invalidCount = 0;

        for (AuditEvent event : events) {
            String expected = hasher.hash(canonicalPayload(event) + "|" + previousHash);
            if (!expected.equals(event.getEventHash())) {
                invalidCount++;
            }
            previousHash = event.getEventHash();
        }

        Map<String, Object> report = new HashMap<>();
        report.put("totalEvents", events.size());
        report.put("invalidEvents", invalidCount);
        report.put("chainValid", invalidCount == 0);
        report.put("latestHash", events.isEmpty() ? null : events.get(events.size() - 1).getEventHash());
        return report;
    }

    private String canonicalPayload(AuditEvent event) {
        return String.join("|",
                safe(event.getEventId(), ""),
                String.valueOf(event.getOccurredAt()),
                safe(event.getActor(), ""),
                safe(event.getAction(), ""),
                safe(event.getResourceType(), ""),
                safe(event.getResourceId(), ""),
                String.valueOf(event.getDepartmentId()),
                safe(event.getMetadataJson(), "{}"),
                safe(event.getTraceId(), "")
        );
    }

    private String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
