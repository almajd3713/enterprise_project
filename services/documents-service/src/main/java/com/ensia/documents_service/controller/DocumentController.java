package com.ensia.documents_service.controller;

import com.ensia.documents_service.audit.AuditEventPublisher;
import com.ensia.documents_service.messaging.DocumentEventPublisher;
import com.ensia.documents_service.model.Document;
import com.ensia.documents_service.repository.DocumentRepository;
import com.ensia.documents_service.security.AuthenticatedUser;
import com.ensia.documents_service.security.DownloadLinkTokenService;
import com.ensia.documents_service.service.S3Service;
import io.jsonwebtoken.Claims;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URLEncoder;
import java.time.Duration;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/documents")
public class DocumentController {
    private static final Logger log = LoggerFactory.getLogger(DocumentController.class);

    private final DocumentRepository repository;
    private final S3Service s3Service;
    private final DocumentEventPublisher documentEventPublisher;
    private final AuditEventPublisher auditEventPublisher;
    private final DownloadLinkTokenService downloadLinkTokenService;
    private final RestClient restClient;
    private final String commentsServiceUrl;

    public DocumentController(DocumentRepository repository,
                              @org.springframework.beans.factory.annotation.Autowired(required = false) S3Service s3Service,
                              DocumentEventPublisher documentEventPublisher,
                              AuditEventPublisher auditEventPublisher,
                              DownloadLinkTokenService downloadLinkTokenService,
                              @Value("${comments.service.url:http://localhost:8083}") String commentsServiceUrl) {
        this.repository = repository;
        this.s3Service = s3Service;
        this.documentEventPublisher = documentEventPublisher;
        this.auditEventPublisher = auditEventPublisher;
        this.downloadLinkTokenService = downloadLinkTokenService;
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
    public ResponseEntity<Document> getDocument(@PathVariable Long id, Authentication authentication) {
        AuthenticatedUser user = resolveUser(authentication);
        Optional<Document> existing = repository.findById(id);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Document document = existing.get();
        if (!canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(document);
    }

    // ✅ GET documents/full/{id} — returns document + comments
    @GetMapping("/full/{id}")
    public ResponseEntity<Map<String, Object>> getFullDocument(@PathVariable Long id,
                                                               Authentication authentication,
                                                               @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document == null || !canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.notFound().build();
        }

        List<?> comments;
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            try {
                comments = restClient.get()
                        .uri(commentsServiceUrl + "/comments/list/" + id)
                        .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                        .retrieve()
                        .body(new ParameterizedTypeReference<List<?>>() {});
            } catch (RestClientException ex) {
                // Degrade gracefully: detail page should still load even if comments API is unavailable/unauthorized.
                log.warn("Failed to fetch comments for document {} from {}: {}", id, commentsServiceUrl, ex.getMessage());
                comments = List.of();
            }
        } else {
            comments = List.of();
        }

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
        document.setDescription(normalizeDescription(document.getDescription()));
        Document saved = repository.save(document);
        safePublishDocumentUploaded(saved);
        safeAuditPublish(user.username(), "CREATE_DOCUMENT", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("title", saved.getTitle()));
        return saved;
    }

    @PatchMapping("/{id}")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<?> updateDocument(@PathVariable Long id, @RequestBody Document request, Authentication authentication) {
        AuthenticatedUser user = resolveUser(authentication);
        Optional<Document> existing = repository.findById(id);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Document document = existing.get();
        if (!canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }

        String title = request == null || request.getTitle() == null ? "" : request.getTitle().trim();
        if (title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "title is required"));
        }
        if (!canAccessDepartment(user, request.getDepartmentId())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }

        document.setTitle(title);
        document.setDescription(normalizeDescription(request.getDescription()));
        document.setDepartmentId(request.getDepartmentId());
        document.setCategoryId(request.getCategoryId());

        Document saved = repository.save(document);
        safeAuditPublish(
                user.username(),
                "UPDATE_DOCUMENT",
                "Document",
                String.valueOf(saved.getId()),
                saved.getDepartmentId(),
                Map.of("title", saved.getTitle())
        );
        return ResponseEntity.ok(saved);
    }

    // ✅ POST documents/upload - Create document with file
    @PostMapping("/upload")
    public ResponseEntity<Document> uploadDocument(
            @RequestParam("title") String title,
            @RequestParam(value = "description", required = false) String description,
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
        document.setDescription(normalizeDescription(description));
        document.setFileName(file.getOriginalFilename());
        document.setFileKey(fileKey);
        document.setContentType(file.getContentType());
        document.setFileSize(file.getSize());
        document.setOwnerId(user.username());
        document.setDepartmentId(departmentId);
        document.setCategoryId(categoryId);
        
        Document saved = repository.save(document);
        safePublishDocumentUploaded(saved);
        safeAuditPublish(authentication.getName(), "UPLOAD_DOCUMENT", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("fileName", saved.getFileName()));
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
        safePublishDocumentUploaded(saved);
        safeAuditPublish("system", "REPLACE_DOCUMENT_FILE", "Document", String.valueOf(saved.getId()), saved.getDepartmentId(), Map.of("fileName", saved.getFileName()));
        return ResponseEntity.ok(saved);
    }

    // ✅ GET documents/delete/{id}
    @DeleteMapping("/{id}")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<Map<String, String>> deleteDocumentById(@PathVariable Long id, Authentication authentication) {
        return deleteDocumentInternal(id, authentication);
    }

    @GetMapping("/delete/{id}")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable Long id, Authentication authentication) {
        return deleteDocumentInternal(id, authentication);
    }

    private ResponseEntity<Map<String, String>> deleteDocumentInternal(Long id, Authentication authentication) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document != null && !canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }
        repository.deleteById(id);
        safeAuditPublish(user.username(), "DELETE_DOCUMENT", "Document", String.valueOf(id), document != null ? document.getDepartmentId() : null, Map.of());
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
        safeAuditPublish("authenticated", "DOWNLOAD_DOCUMENT", "Document", String.valueOf(id), document.getDepartmentId(), Map.of("fileName", document.getFileName()));
        
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
        safeAuditPublish("authenticated", "GENERATE_PRESIGNED_URL", "Document", String.valueOf(id), document.getDepartmentId(), Map.of("fileName", document.getFileName()));
        return ResponseEntity.ok(Map.of(
                "documentId", String.valueOf(id),
                "fileName", document.getFileName() != null ? document.getFileName() : "",
                "url", url
        ));
    }

    @GetMapping("/{id}/download-link")
    public ResponseEntity<Map<String, String>> getSecureDownloadLink(@PathVariable Long id, Authentication authentication) {
        if (s3Service == null) {
            return ResponseEntity.status(503).body(Map.of("error", "S3 not configured"));
        }
        AuthenticatedUser user = resolveUser(authentication);
        Document document = repository.findById(id).orElse(null);
        if (document == null || document.getFileKey() == null || !canAccessDepartment(user, document.getDepartmentId())) {
            return ResponseEntity.notFound().build();
        }

        String sessionId = UUID.randomUUID().toString();
        String token = downloadLinkTokenService.createToken(id, user.username(), sessionId);
        String path = "/api/documents/download?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
        ResponseCookie cookie = ResponseCookie.from("dms_dl_sid", sessionId)
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofMinutes(downloadLinkTokenService.expiryMinutes()))
                .build();
        safeAuditPublish(
                user.username(),
                "GENERATE_SECURE_DOWNLOAD_LINK",
                "Document",
                String.valueOf(id),
                document.getDepartmentId(),
                Map.of("fileName", document.getFileName())
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of(
                "documentId", String.valueOf(id),
                "fileName", document.getFileName() != null ? document.getFileName() : "",
                "path", path,
                "expiresInMinutes", String.valueOf(downloadLinkTokenService.expiryMinutes())
        ));
    }

    @GetMapping("/download")
    public ResponseEntity<byte[]> downloadBySecureLink(@RequestParam("token") String token,
                                                       @CookieValue(name = "dms_dl_sid", required = false) String sessionCookie) throws IOException {
        if (s3Service == null) {
            return ResponseEntity.status(503).build();
        }
        Claims claims;
        try {
            claims = downloadLinkTokenService.parseAndValidate(token);
        } catch (Exception ex) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
        }

        String subject = claims.getSubject();
        Object sidClaim = claims.get("sid");
        String sid = sidClaim == null ? "" : sidClaim.toString();
        if (subject == null || sid.isBlank() || sessionCookie == null || !sid.equals(sessionCookie)) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }

        Object rawDocId = claims.get("docId");
        if (!(rawDocId instanceof Number)) {
            return ResponseEntity.badRequest().build();
        }
        Long documentId = ((Number) rawDocId).longValue();
        Document document = repository.findById(documentId).orElse(null);
        if (document == null || document.getFileKey() == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }

        byte[] fileData = s3Service.downloadFile(document.getFileKey());
        ResponseCookie refreshedCookie = ResponseCookie.from("dms_dl_sid", sid)
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofMinutes(downloadLinkTokenService.expiryMinutes()))
                .build();
        safeAuditPublish(
                subject,
                "DOWNLOAD_DOCUMENT_SECURE_LINK",
                "Document",
                String.valueOf(documentId),
                document.getDepartmentId(),
                Map.of("fileName", document.getFileName())
        );
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshedCookie.toString())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + document.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(document.getContentType()))
                .body(fileData);
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

        safePublishDocumentUploaded(document);
        safeAuditPublish(user.username(), "REQUEST_TRANSLATION", "Document", String.valueOf(id), document.getDepartmentId(), Map.of("title", document.getTitle()));
        return ResponseEntity.ok(Map.of("message", "Translation requested", "documentId", String.valueOf(id)));
    }

    private void safePublishDocumentUploaded(Document document) {
        try {
            documentEventPublisher.publishDocumentUploaded(document);
        } catch (Exception ex) {
            log.warn("Failed to publish document-uploaded event for doc {}: {}", document != null ? document.getId() : null, ex.getMessage());
        }
    }

    private void safeAuditPublish(String actor, String action, String resourceType, String resourceId, Long departmentId, Map<String, Object> metadata) {
        try {
            auditEventPublisher.publish(actor, action, resourceType, resourceId, departmentId, metadata);
        } catch (Exception ex) {
            log.warn("Failed to publish audit event action={} resourceId={}: {}", action, resourceId, ex.getMessage());
        }
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

    private String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String trimmed = description.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
