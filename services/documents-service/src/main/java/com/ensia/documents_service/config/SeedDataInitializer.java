package com.ensia.documents_service.config;

import com.ensia.documents_service.model.Category;
import com.ensia.documents_service.model.Document;
import com.ensia.documents_service.repository.CategoryRepository;
import com.ensia.documents_service.repository.DocumentRepository;
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

    public SeedDataInitializer(CategoryRepository categoryRepository, DocumentRepository documentRepository) {
        this.categoryRepository = categoryRepository;
        this.documentRepository = documentRepository;
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
        docs.add(createDocument(
                "Q1 Revenue Snapshot",
                "user",
                1L,
                categoryIdsByName.get("Finance"),
                "q1-revenue-snapshot.pdf",
                "application/pdf",
                358_221L,
                "Resume trimestriel des revenus avec tendances principales."
        ));
        docs.add(createDocument(
                "Employment Contract Template v4",
                "user",
                2L,
                categoryIdsByName.get("Human Resources"),
                "employment-contract-template-v4.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                147_032L,
                null
        ));
        docs.add(createDocument(
                "Customer SLA 2026",
                "admin",
                3L,
                categoryIdsByName.get("Legal"),
                "customer-sla-2026.pdf",
                "application/pdf",
                213_880L,
                "Accord de niveau de service avec délais d'escalade et remediation."
        ));
        docs.add(createDocument(
                "Platform Migration Runbook",
                "admin",
                4L,
                categoryIdsByName.get("Engineering"),
                "platform-migration-runbook.md",
                "text/markdown",
                82_964L,
                ""
        ));
        docs.add(createDocument(
                "Warehouse Incident RCA 14-03",
                "admin",
                5L,
                categoryIdsByName.get("Operations"),
                "warehouse-incident-rca-14-03.pdf",
                "application/pdf",
                501_290L,
                null
        ));
        docs.add(createDocument(
                "Enterprise Pipeline Forecast",
                "user",
                1L,
                categoryIdsByName.get("Sales"),
                "enterprise-pipeline-forecast.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                194_600L,
                "Forecast model grouped by region, segment, and close probability."
        ));
        docs.add(createDocument(
                "Roadmap Themes H2 2026",
                "admin",
                4L,
                categoryIdsByName.get("Product"),
                "roadmap-themes-h2-2026.pptx",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                2_046_700L,
                "Product themes, milestones, and cross-team dependencies for H2."
        ));

        documentRepository.saveAll(docs);
    }

    private Document createDocument(String title,
                                    String ownerId,
                                    Long departmentId,
                                    Long categoryId,
                                    String fileName,
                                    String contentType,
                                    Long fileSize,
                                    String translatedText) {
        Document document = new Document();
        document.setTitle(title);
        document.setOwnerId(ownerId);
        document.setDepartmentId(departmentId);
        document.setCategoryId(categoryId);
        document.setFileName(fileName);
        document.setFileKey("seed/" + fileName);
        document.setContentType(contentType);
        document.setFileSize(fileSize);
        document.setTranslatedText(translatedText);
        return document;
    }
}
