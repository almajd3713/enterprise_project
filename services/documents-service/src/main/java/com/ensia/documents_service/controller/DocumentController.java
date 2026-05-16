package com.ensia.documents_service.controller;

import com.ensia.documents_service.messaging.DocumentEventPublisher;
import com.ensia.documents_service.audit.AuditEventPublisher;
import com.ensia.documents_service.model.Document;
import com.ensia.documents_service.repository.CategoryRepository;
import com.ensia.documents_service.repository.DocumentRepository;
import com.ensia.documents_service.security.AuthenticatedUser;
import com.ensia.documents_service.service.S3Service;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/documents")
public class DocumentController {

    private final DocumentRepository repository;
    private final CategoryRepository categoryRepository;
    private final S3Service s3Service;
    private final DocumentEventPublisher documentEventPublisher;
    private final AuditEventPublisher auditEventPublisher;
    private final RestClient restClient;
    private final String commentsServiceUrl;

    public DocumentController(DocumentRepository repository,
                              CategoryRepository categoryRepository,
                              @org.springframework.beans.factory.annotation.Autowired(required = false) S3Service s3Service,
                              DocumentEventPublisher documentEventPublisher,
                              AuditEventPublisher auditEventPublisher,
                              @Value("${comments.service.url:http://localhost:8083}") String commentsServiceUrl) {
        this.repository = repository;
        this.categoryRepository = categoryRepository;
        this.s3Service = s3Service;
        this.documentEventPublisher = documentEventPublisher;
        this.auditEventPublisher = auditEventPublisher;
        this.commentsServiceUrl = commentsServiceUrl;
        this.restClient = RestClient.create();
    }

    @GetMapping("/list")
    public List<Document> listDocuments(Authentication authentication) {
        AuthenticatedUser user = requireUser(authentication);
        if (user.isAdmin()) {
            return repository.findAll();
        }
        Set<Long> allowedDepartments = user.departmentIds();
        if (allowedDepartments.isEmpty()) {
            return List.of();
        }
        return repository.findByDepartmentIdIn(allowedDepartments);
    }

    @GetMapping("/get/{id}")
    @Cacheable(value = "documents", key = "#id")
    public ResponseEntity<Document> getDocument(@PathVariable Long id, Authentication authentication) {
        Document document = repository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessDocument(authentication, document)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(document);
    }

    @GetMapping("/full/{id}")
    public ResponseEntity<Map<String, Object>> getFullDocument(@PathVariable Long id,
                                                               Authentication authentication,
                                                               HttpServletRequest request) {
        Document document = repository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessDocument(authentication, document)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<?> comments = restClient.get()
                .uri(commentsServiceUrl + "/comments/list/" + id)
                .header(HttpHeaders.AUTHORIZATION, request.getHeader(HttpHeaders.AUTHORIZATION))
                .retrieve()
                .body(new ParameterizedTypeReference<List<?>>() {});

        Map<String, Object> result = new HashMap<>();
        result.put("document", document);
        result.put("comments", comments);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/add")
    public ResponseEntity<?> addDocument(@RequestBody Document document, Authentication authentication) {
        AuthenticatedUser user = requireUser(authentication);
        if (document.getDepartmentId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "departmentId is required"));
        }
        if (document.getCategoryId() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "categoryId is required"));
        }
        if (!categoryRepository.existsById(document.getCategoryId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "categoryId does not exist"));
        }
        if (!user.isAdmin() && !user.departmentIds().contains(document.getDepartmentId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Cannot create documents outside your departments"));
        }

        document.setOwnerId(user.username());
        Document saved = repository.save(document);
        auditEventPublisher.publish(user.username(), "CREATE_DOCUMENT", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("title", saved.getTitle()));
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(
            @RequestParam("title") String title,
            @RequestParam("departmentId") Long departmentId,
            @RequestParam("categoryId") Long categoryId,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) throws IOException {

        AuthenticatedUser user = requireUser(authentication);
        if (!user.isAdmin() && !user.departmentIds().contains(departmentId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Cannot upload documents outside your departments"));
        }
        if (!categoryRepository.existsById(categoryId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "categoryId does not exist"));
        }

        String fileKey = s3Service.uploadFile(file);

        Document document = new Document();
        document.setTitle(title);
        document.setDepartmentId(departmentId);
        document.setCategoryId(categoryId);
        document.setFileName(file.getOriginalFilename());
        document.setFileKey(fileKey);
        document.setContentType(file.getContentType());
        document.setFileSize(file.getSize());
        document.setOwnerId(user.username());

        Document saved = repository.save(document);
        documentEventPublisher.publishDocumentUploaded(saved);
        auditEventPublisher.publish(user.username(), "UPLOAD_DOCUMENT", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("fileName", saved.getFileName()));
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/file")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<?> uploadFileToDocument(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) throws IOException {

        Document document = repository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessDocument(authentication, document)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (document.getFileKey() != null) {
            s3Service.deleteFile(document.getFileKey());
        }

        String fileKey = s3Service.uploadFile(file);
        document.setFileName(file.getOriginalFilename());
        document.setFileKey(fileKey);
        document.setContentType(file.getContentType());
        document.setFileSize(file.getSize());

        Document saved = repository.save(document);
        documentEventPublisher.publishDocumentUploaded(saved);
        auditEventPublisher.publish(requireUser(authentication).username(), "REPLACE_FILE", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("fileName", saved.getFileName()));
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/delete/{id}")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable Long id, Authentication authentication) {
        Document document = repository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessDocument(authentication, document)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        repository.deleteById(id);
        auditEventPublisher.publish(requireUser(authentication).username(), "DELETE_DOCUMENT", "Document", String.valueOf(id), document.getDepartmentId(), Map.of());
        return ResponseEntity.ok(Map.of("message", "Document deleted with id: " + id));
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> downloadDocumentFile(@PathVariable Long id, Authentication authentication) throws IOException {
        Document document = repository.findById(id).orElse(null);
        if (document == null || document.getFileKey() == null) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessDocument(authentication, document)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        byte[] fileData = s3Service.downloadFile(document.getFileKey());
        auditEventPublisher.publish(requireUser(authentication).username(), "DOWNLOAD_DOCUMENT_FILE", "Document", String.valueOf(id), document.getDepartmentId(), Map.of("fileName", document.getFileName()));

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + document.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(document.getContentType()))
                .body(fileData);
    }

    @GetMapping("/{id}/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(@PathVariable Long id, Authentication authentication) {
        if (s3Service == null) {
            return ResponseEntity.status(503).body(Map.of("error", "S3 not configured"));
        }

        Document document = repository.findById(id).orElse(null);
        if (document == null || document.getFileKey() == null) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessDocument(authentication, document)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        String url = s3Service.generatePresignedUrl(document.getFileKey());
        auditEventPublisher.publish(requireUser(authentication).username(), "GENERATE_PRESIGNED_URL", "Document", String.valueOf(id), document.getDepartmentId(), Map.of("fileName", document.getFileName()));
        return ResponseEntity.ok(Map.of(
                "documentId", String.valueOf(id),
                "fileName", document.getFileName() != null ? document.getFileName() : "",
                "url", url
        ));
    }

    private boolean canAccessDocument(Authentication authentication, Document document) {
        AuthenticatedUser user = requireUser(authentication);
        if (user.isAdmin()) {
            return true;
        }
        return document.getDepartmentId() != null && user.departmentIds().contains(document.getDepartmentId());
    }

    private AuthenticatedUser requireUser(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new IllegalStateException("Unauthenticated request");
        }
        if (authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        return new AuthenticatedUser(authentication.getName(), Set.of(), Set.of());
    }
}
