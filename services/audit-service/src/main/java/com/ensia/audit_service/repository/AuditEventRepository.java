package com.ensia.audit_service.repository;

import com.ensia.audit_service.model.AuditEvent;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {
    Optional<AuditEvent> findTopByOrderByIdDesc();
}
