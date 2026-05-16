package com.ensia.audit_service.controller;

import com.ensia.audit_service.model.AuditEvent;
import com.ensia.audit_service.service.AuditEventService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/audit")
public class AuditController {

    private final AuditEventService auditEventService;

    public AuditController(AuditEventService auditEventService) {
        this.auditEventService = auditEventService;
    }

    @GetMapping("/events")
    public List<AuditEvent> listEvents() {
        return auditEventService.list();
    }

    @GetMapping("/integrity-report")
    public Map<String, Object> integrityReport() {
        return auditEventService.integrityReport();
    }
}
