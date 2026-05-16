package com.ensia.documents_service.repository;

import com.ensia.documents_service.model.Document;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByDepartmentIdIn(Collection<Long> departmentIds);
}
