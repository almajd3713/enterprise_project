package com.ensia.documents_service.controller;

import com.ensia.documents_service.messaging.DocumentEventPublisher;
import com.ensia.documents_service.model.Document;
import com.ensia.documents_service.repository.DocumentRepository;
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

@RestController
@RequestMapping("/documents")
public class DocumentController {

    private final DocumentRepository repository;
    private final S3Service s3Service;
    private final DocumentEventPublisher documentEventPublisher;
    private final RestClient restClient;
    private final String commentsServiceUrl;

    public DocumentController(DocumentRepository repository,
                              @org.springframework.beans.factory.annotation.Autowired(required = false) S3Service s3Service,
                              DocumentEventPublisher documentEventPublisher,
                              @Value("${comments.service.url:http://localhost:8083}") String commentsServiceUrl) {
        this.repository = repository;
        this.s3Service = s3Service;
        this.documentEventPublisher = documentEventPublisher;
        this.commentsServiceUrl = commentsServiceUrl;
        this.restClient = RestClient.create();
    }

    // ✅ GET documents/list
    @GetMapping("/list")
    public List<Document> listDocuments() {
        return repository.findAll();
    }

    // ✅ GET documents/get/{id}
    @GetMapping("/get/{id}")
    @Cacheable(value = "documents", key = "#id")
    public Document getDocument(@PathVariable Long id) {
        return repository.findById(id).orElse(null);
    }

    // ✅ GET documents/full/{id} — returns document + comments
    @GetMapping("/full/{id}")
    public ResponseEntity<Map<String, Object>> getFullDocument(@PathVariable Long id) {
        Document document = repository.findById(id).orElse(null);
        if (document == null) {
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
        document.setOwnerId(authentication.getName());
        return repository.save(document);
    }

    // ✅ POST documents/upload - Create document with file
    @PostMapping("/upload")
    public ResponseEntity<Document> uploadDocument(
            @RequestParam("title") String title,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) throws IOException {
        
        String fileKey = s3Service.uploadFile(file);
        
        Document document = new Document();
        document.setTitle(title);
        document.setFileName(file.getOriginalFilename());
        document.setFileKey(fileKey);
        document.setContentType(file.getContentType());
        document.setFileSize(file.getSize());
        document.setOwnerId(authentication.getName());
        
        Document saved = repository.save(document);
        documentEventPublisher.publishDocumentUploaded(saved);
        return ResponseEntity.ok(saved);
    }

    // ✅ POST documents/{id}/file - Upload file to existing document
    @PostMapping("/{id}/file")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<Document> uploadFileToDocument(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) throws IOException {
        
        Document document = repository.findById(id).orElse(null);
        if (document == null) {
            return ResponseEntity.notFound().build();
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
        return ResponseEntity.ok(saved);
    }

    // ✅ GET documents/delete/{id}
    @GetMapping("/delete/{id}")
    @CacheEvict(value = "documents", key = "#id")
    public ResponseEntity<Map<String, String>> deleteDocument(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        repository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Document deleted with id: " + id));
    }

    // ✅ GET documents/{id}/file - Download document file (proxied)
    @GetMapping("/{id}/file")
    public ResponseEntity<byte[]> downloadDocumentFile(@PathVariable Long id) throws IOException {
        Document document = repository.findById(id).orElse(null);
        if (document == null || document.getFileKey() == null) {
            return ResponseEntity.notFound().build();
        }
        
        byte[] fileData = s3Service.downloadFile(document.getFileKey());
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + document.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(document.getContentType()))
                .body(fileData);
    }

    // ✅ GET documents/{id}/presigned-url - Get a temporary pre-signed download URL
    @GetMapping("/{id}/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(@PathVariable Long id) {
        if (s3Service == null) {
            return ResponseEntity.status(503).body(Map.of("error", "S3 not configured"));
        }

        Document document = repository.findById(id).orElse(null);
        if (document == null || document.getFileKey() == null) {
            return ResponseEntity.notFound().build();
        }

        String url = s3Service.generatePresignedUrl(document.getFileKey());
        return ResponseEntity.ok(Map.of(
                "documentId", String.valueOf(id),
                "fileName", document.getFileName() != null ? document.getFileName() : "",
                "url", url
        ));
    }
}