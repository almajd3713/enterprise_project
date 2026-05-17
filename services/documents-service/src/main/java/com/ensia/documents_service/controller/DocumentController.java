package com.ensia.documents_service.controller;

import com.ensia.documents_service.audit.AuditEventPublisher;
import com.ensia.documents_service.messaging.DocumentEventPublisher;
import com.ensia.documents_service.model.Document;
import com.ensia.documents_service.repository.DocumentRepository;
import com.ensia.documents_service.security.AuthenticatedUser;
import com.ensia.documents_service.service.S3Service;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/documents")
public class DocumentController {

    private final DocumentRepository repository;
    private final S3Service s3Service;
    private final DocumentEventPublisher documentEventPublisher;
    private final AuditEventPublisher auditEventPublisher;
    private final RestClient restClient;
    private final String commentsServiceUrl;

    public DocumentController(DocumentRepository repository,
                              @org.springframework.beans.factory.annotation.Autowired(required = false) S3Service s3Service,
                              DocumentEventPublisher documentEventPublisher,
                              AuditEventPublisher auditEventPublisher,
                              @Value("${comments.service.url:http://localhost:8083}") String commentsServiceUrl) {
        this.repository = repository;
        this.s3Service = s3Service;
        this.documentEventPublisher = documentEventPublisher;
        this.auditEventPublisher = auditEventPublisher;
        this.commentsServiceUrl = commentsServiceUrl;
        this.restClient = RestClient.create();
    }

    // ✅ GET documents/list
    @GetMapping("/list")
    public List<Document> listDocuments(Authentication authentication) {
        AuthenticatedUser user = resolveUser(authentication);
        if (user.isAdmin()) {
            return repository.findAll();
        }
        if (user.departmentIds().isEmpty()) {
            return List.of();
        }
        return repository.findByDepartmentIdIn(user.departmentIds());
    }

    // ✅ GET documents/get/{id}
    @GetMapping("/get/{id}")
    @Cacheable(value = "documents", key = "#id")
    public Document getDocument(@PathVariable Long id, Authentication authentication) {
        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document == null || !canAccessDepartment(user, document.getDepartmentId())) {
            return null;
        }
        return document;
    }

    // ✅ GET documents/full/{id} — returns document + comments
    @GetMapping("/full/{id}")
    public ResponseEntity<Map<String, Object>> getFullDocument(@PathVariable Long id, Authentication authentication) {
        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document == null || !canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.notFound().build();
        }

        List<?> comments = restClient.get()
                .uri(commentsServiceUrl + "/comments/list/" + id)
                .retrieve()
                .body(new ParameterizedTypeReference<List<?>>() {});

        Map<String, Object> result = new HashMap<>();
        result.put("document", document);
        result.put("comments", comments);
        return ResponseEntity.ok(result);
    }

    // ✅ POST documents/add
    @PostMapping("/add")
    public Document addDocument(@RequestBody Document document, Authentication authentication) {
        AuthenticatedUser user = resolveUser(authentication);
        if (!canAccessDepartment(user, document.getDepartmentId())) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Forbidden department");
        }
        document.setOwnerId(user.username());
        Document saved = repository.save(document);
        documentEventPublisher.publishDocumentUploaded(saved);
        auditEventPublisher.publish(user.username(), "CREATE_DOCUMENT", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("title", saved.getTitle()));
        return saved;
    }

    // ✅ POST documents/upload - Create document with file
    @PostMapping("/upload")
    public ResponseEntity<Document> uploadDocument(
            @RequestParam("title") String title,
            @RequestParam(value = "departmentId", required = false) Long departmentId,
            @RequestParam(value = "categoryId", required = false) Long categoryId,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) throws IOException {
        AuthenticatedUser user = resolveUser(authentication);
        if (!canAccessDepartment(user, departmentId)) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }
        
        String fileKey = s3Service.uploadFile(file);
        
        Document document = new Document();
        document.setTitle(title);
        document.setFileName(file.getOriginalFilename());
        document.setFileKey(fileKey);
        document.setContentType(file.getContentType());
        document.setFileSize(file.getSize());
        document.setOwnerId(user.username());
        document.setDepartmentId(departmentId);
        document.setCategoryId(categoryId);
        
        Document saved = repository.save(document);
        documentEventPublisher.publishDocumentUploaded(saved);
        auditEventPublisher.publish(authentication.getName(), "UPLOAD_DOCUMENT", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("fileName", saved.getFileName()));
        return ResponseEntity.ok(saved);
    }

    // ✅ POST documents/{id}/file - Upload file to existing document
    @PostMapping("/{id}/file")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<Document> uploadFileToDocument(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) throws IOException {
        AuthenticatedUser user = resolveUser(authentication);
        
        Document document = repository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }
        
        // Delete old file if exists
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
        auditEventPublisher.publish("system", "REPLACE_DOCUMENT_FILE", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("fileName", saved.getFileName()));
        return ResponseEntity.ok(saved);
    }

    // ✅ GET documents/delete/{id}
    @GetMapping("/delete/{id}")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable Long id, Authentication authentication) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document != null && !canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }
        repository.deleteById(id);
        auditEventPublisher.publish("system", "DELETE_DOCUMENT", "Document", String.valueOf(id), document != null ? document.getDepartmentId() : null, Map.of());
        return ResponseEntity.ok(Map.of("message", "Document deleted with id: " + id));
    }

    // ✅ GET documents/{id}/file - Download document file (proxied)
    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> downloadDocumentFile(@PathVariable Long id, Authentication authentication) throws IOException {
        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document == null || document.getFileKey() == null || !canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.notFound().build();
        }
        
        byte[] fileData = s3Service.downloadFile(document.getFileKey());
        auditEventPublisher.publish("authenticated", "DOWNLOAD_DOCUMENT", "Document", String.valueOf(id), document.getDepartmentId(), Map.of("fileName", document.getFileName()));
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + document.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(document.getContentType()))
                .body(fileData);
    }

    // ✅ GET documents/{id}/presigned-url - Get a temporary pre-signed download URL
    @GetMapping("/{id}/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(@PathVariable Long id, Authentication authentication) {
        if (s3Service == null) {
            return ResponseEntity.status(503).body(Map.of("error", "S3 not configured"));
        }

        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document == null || document.getFileKey() == null || !canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.notFound().build();
        }

        String url = s3Service.generatePresignedUrl(document.getFileKey());
        auditEventPublisher.publish("authenticated", "GENERATE_PRESIGNED_URL", "Document", String.valueOf(id), document.getDepartmentId(), Map.of("fileName", document.getFileName()));
        return ResponseEntity.ok(Map.of(
                "documentId", String.valueOf(id),
                "fileName", document.getFileName() != null ? document.getFileName() : "",
                "url", url
        ));
    }

    @PostMapping("/{id}/translate")
    public ResponseEntity<Map<String, String>> requestTranslation(@PathVariable Long id, Authentication authentication) {
        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
        }
        if (!canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }

        documentEventPublisher.publishDocumentUploaded(document);
        auditEventPublisher.publish(user.username(), "REQUEST_TRANSLATION", "Document", String.valueOf(id), document.getDepartmentId(), Map.of("title", document.getTitle()));
        return ResponseEntity.ok(Map.of("message", "Translation requested", "documentId", String.valueOf(id)));
    }

    private AuthenticatedUser resolveUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        String username = authentication != null ? authentication.getName() : "anonymous";
        Set<String> roles = authentication == null ? Set.of() : authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority().replace("ROLE_", ""))
                .collect(Collectors.toSet());
        return new AuthenticatedUser(username, roles, Set.of());
    }

    private boolean canAccessDepartment(AuthenticatedUser user, Long departmentId) {
        if (user.isAdmin()) {
            return true;
        }
        if (departmentId == null) {
            return false;
        }
        return user.departmentIds().contains(departmentId);
    }
}
