package com.ensia.documents_service.config;

import com.ensia.documents_service.model.Category;
import com.ensia.documents_service.model.Document;
import com.ensia.documents_service.repository.CategoryRepository;
import com.ensia.documents_service.repository.DocumentRepository;
import com.ensia.documents_service.service.S3Service;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SeedDataInitializer {

    private final CategoryRepository categoryRepository;
    private final DocumentRepository documentRepository;
    private final S3Service s3Service;

    public SeedDataInitializer(CategoryRepository categoryRepository,
                               DocumentRepository documentRepository,
                               @org.springframework.beans.factory.annotation.Autowired(required = false) S3Service s3Service) {
        this.categoryRepository = categoryRepository;
        this.documentRepository = documentRepository;
        this.s3Service = s3Service;
    }

    @PostConstruct
    @Transactional
    public void seedIfMissing() {
        Map<String, Long> categoryIdsByName = ensureCategories();
        ensureDocuments(categoryIdsByName);
    }

    private Map<String, Long> ensureCategories() {
        String[] categories = {
                "Finance",
                "Legal",
                "Human Resources",
                "Engineering",
                "Operations",
                "Sales",
                "Product"
        };

        Map<String, Long> ids = new LinkedHashMap<>();
        for (String categoryName : categories) {
            Category category = categoryRepository.findByNameIgnoreCase(categoryName)
                    .orElseGet(() -> {
                        Category created = new Category();
                        created.setName(categoryName);
                        return categoryRepository.save(created);
                    });
            ids.put(categoryName, category.getId());
        }
        return ids;
    }

    private void ensureDocuments(Map<String, Long> categoryIdsByName) {
        if (documentRepository.count() > 0) {
            return;
        }

        List<Document> docs = new ArrayList<>();
        docs.add(createDocumentWithPlaceholder(
                "Q1 Revenue Snapshot",
                "Quarterly summary of revenue performance across regions and product lines.",
                "user",
                1L,
                categoryIdsByName.get("Finance"),
                "q1-revenue-snapshot.txt",
                "Resume trimestriel des revenus avec tendances principales.",
                "Synthese trimestrielle des performances de revenus par region et ligne de produit.",
                "Q1 seeded placeholder document content."
        ));
        docs.add(createDocumentWithPlaceholder(
                "Employment Contract Template v4",
                "Standardized employment contract template for full-time onboarding.",
                "user",
                2L,
                categoryIdsByName.get("Human Resources"),
                "employment-contract-template-v4.txt",
                null,
                null,
                "Employment template seeded placeholder."
        ));
        docs.add(createDocumentWithPlaceholder(
                "Customer SLA 2026",
                "Service-level agreement for enterprise customer support obligations in 2026.",
                "admin",
                3L,
                categoryIdsByName.get("Legal"),
                "customer-sla-2026.txt",
                "Accord de niveau de service avec délais d'escalade et remediation.",
                "Accord de niveau de service pour les obligations de support client en 2026.",
                "SLA seeded placeholder document content."
        ));
        docs.add(createDocumentWithoutAttachment(
                "Platform Migration Runbook",
                "Step-by-step operational guide for platform migration and rollback.",
                "admin",
                4L,
                categoryIdsByName.get("Engineering"),
                "",
                "Guide operationnel etapes par etapes pour migration et retour arriere."
        ));
        docs.add(createDocumentWithoutAttachment(
                "Warehouse Incident RCA 14-03",
                "Root cause analysis for the March 14 warehouse incident and corrective actions.",
                "admin",
                5L,
                categoryIdsByName.get("Operations"),
                null,
                null
        ));
        docs.add(createDocumentWithoutAttachment(
                "Enterprise Pipeline Forecast",
                "Sales pipeline outlook by region, segment, and probability-weighted close date.",
                "user",
                1L,
                categoryIdsByName.get("Sales"),
                "Forecast model grouped by region, segment, and close probability.",
                "Perspective commerciale par region, segment et probabilite de conclusion."
        ));
        docs.add(createDocumentWithoutAttachment(
                "Roadmap Themes H2 2026",
                "Product roadmap themes, milestones, and dependencies for H2 planning.",
                "admin",
                4L,
                categoryIdsByName.get("Product"),
                "Product themes, milestones, and cross-team dependencies for H2.",
                "Themes produit, jalons et dependances inter-equipes pour la planification H2."
        ));

        documentRepository.saveAll(docs);
    }

    private Document createDocumentWithoutAttachment(String title,
                                                     String description,
                                                     String ownerId,
                                                     Long departmentId,
                                                     Long categoryId,
                                                     String translatedText,
                                                     String translatedDescription) {
        Document document = new Document();
        document.setTitle(title);
        document.setDescription(description);
        document.setOwnerId(ownerId);
        document.setDepartmentId(departmentId);
        document.setCategoryId(categoryId);
        document.setTranslatedText(translatedText);
        document.setTranslatedDescription(translatedDescription);
        return document;
    }

    private Document createDocumentWithPlaceholder(String title,
                                                   String description,
                                                   String ownerId,
                                                   Long departmentId,
                                                   Long categoryId,
                                                   String fileName,
                                                   String translatedText,
                                                   String translatedDescription,
                                                   String content) {
        Document document = createDocumentWithoutAttachment(
                title, description, ownerId, departmentId, categoryId, translatedText, translatedDescription
        );

        if (s3Service != null) {
            String key = s3Service.uploadTextPlaceholder(fileName, content);
            document.setFileName(fileName);
            document.setFileKey(key);
            document.setContentType("text/plain");
            document.setFileSize((long) content.length());
        }
        return document;
    }
}
