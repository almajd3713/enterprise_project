package com.ensia.search_service.service;

import com.ensia.search_service.messaging.DocumentUploadedEvent;
import com.ensia.search_service.model.SearchDocument;
import com.ensia.search_service.repository.SearchDocumentRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SearchIndexService {

    private final SearchDocumentRepository repository;

    public SearchIndexService(SearchDocumentRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void upsertFromUpload(DocumentUploadedEvent event) {
        if (event == null || event.documentId() == null) {
            return;
        }

        SearchDocument doc = repository.findById(event.documentId()).orElseGet(SearchDocument::new);
        doc.setDocumentId(event.documentId());
        doc.setTitle(event.title());
        doc.setDescription(event.description());
        doc.setOwnerId(event.ownerId());
        doc.setDepartmentId(event.departmentId());
        doc.setCategoryId(event.categoryId());
        doc.setFileName(event.fileName());
        doc.setContentType(event.contentType());
        doc.setFileSize(event.fileSize());
        doc.setUpdatedAt(Instant.now());
        repository.save(doc);
    }

    @Transactional
    public void applyTranslation(Long documentId, String translatedText, String translatedDescription) {
        if (documentId == null) {
            return;
        }

        repository.findById(documentId).ifPresent(doc -> {
            doc.setTranslatedText(translatedText);
            doc.setTranslatedDescription(translatedDescription);
            doc.setUpdatedAt(Instant.now());
            repository.save(doc);
        });
    }

    @Transactional(readOnly = true)
    public List<SearchDocument> search(String q,
                                       Set<Long> callerDepartments,
                                       boolean isAdmin,
                                       Long departmentId,
                                       Long categoryId,
                                       String ownerId) {
        boolean deptIdsEmpty = isAdmin || callerDepartments == null || callerDepartments.isEmpty();
        List<SearchDocument> results = repository.search(
                q,
                callerDepartments == null ? List.of() : callerDepartments,
                deptIdsEmpty,
                departmentId,
                categoryId
        );

        return results.stream()
                .filter(doc -> isAdmin || (doc.getDepartmentId() != null && callerDepartments.contains(doc.getDepartmentId())))
                .filter(doc -> ownerId == null || (doc.getOwnerId() != null && doc.getOwnerId().equalsIgnoreCase(ownerId)))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> facets(Set<Long> callerDepartments, boolean isAdmin) {
        List<SearchDocument> docs = repository.findAll();
        if (!isAdmin) {
            docs = docs.stream()
                    .filter(d -> d.getDepartmentId() != null && callerDepartments.contains(d.getDepartmentId()))
                    .toList();
        }

        Map<Long, Long> byDepartment = new HashMap<>();
        Map<Long, Long> byCategory = new HashMap<>();
        for (SearchDocument doc : docs) {
            if (doc.getDepartmentId() != null) {
                byDepartment.merge(doc.getDepartmentId(), 1L, Long::sum);
            }
            if (doc.getCategoryId() != null) {
                byCategory.merge(doc.getCategoryId(), 1L, Long::sum);
            }
        }

        Map<String, Object> out = new HashMap<>();
        out.put("total", docs.size());
        out.put("byDepartment", byDepartment);
        out.put("byCategory", byCategory);
        return out;
    }
}
