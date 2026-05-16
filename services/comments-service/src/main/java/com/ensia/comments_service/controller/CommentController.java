package com.ensia.comments_service.controller;

import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.ensia.comments_service.model.Comment;
import com.ensia.comments_service.model.CommentKey;
import com.ensia.comments_service.repository.CommentRepository;
import com.ensia.comments_service.audit.AuditEventPublisher;
import com.ensia.comments_service.service.DocumentAccessService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/comments")
public class CommentController {

    private final CommentRepository repository;
    private final DocumentAccessService documentAccessService;
    private final AuditEventPublisher auditEventPublisher;

    public CommentController(CommentRepository repository, DocumentAccessService documentAccessService, AuditEventPublisher auditEventPublisher) {
        this.repository = repository;
        this.documentAccessService = documentAccessService;
        this.auditEventPublisher = auditEventPublisher;
    }

    // ✅ GET comments/list/{docId}
    @GetMapping("/list/{docId}")
    public ResponseEntity<?> getComments(@PathVariable String docId,
                                         @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader) {
        if (!documentAccessService.canAccessDocument(docId, authorizationHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Forbidden"));
        }
        auditEventPublisher.publish(authenticationNameFromHeader(authorizationHeader), "LIST_COMMENTS", "Comment", docId, Map.of());
        return ResponseEntity.ok(repository.findByKeyDocId(parseDocId(docId)));
    }

    // ✅ POST comments/add
    @PostMapping("/add")
    public ResponseEntity<?> addComment(@RequestBody Comment comment,
                                        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
                                        Authentication authentication) {
        UUID docId;
        String rawDocId;
        if (comment.getKey() != null && comment.getKey().getDocId() != null) {
            docId = comment.getKey().getDocId();
            rawDocId = docId.toString();
        } else if (comment.getDocId() != null && !comment.getDocId().isBlank()) {
            rawDocId = comment.getDocId();
            docId = parseDocId(comment.getDocId());
        } else {
            throw new IllegalArgumentException("key.docId or docId is required");
        }

        if (!documentAccessService.canAccessDocument(rawDocId, authorizationHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Forbidden"));
        }

        comment.setKey(new CommentKey(docId, Uuids.timeBased()));
        if (authentication != null && authentication.getName() != null) {
            comment.setAuthor(authentication.getName());
        }
        Comment saved = repository.save(comment);
        auditEventPublisher.publish(authentication != null ? authentication.getName() : "unknown", "ADD_COMMENT", "Comment", rawDocId, Map.of("author", saved.getAuthor()));
        return ResponseEntity.ok(saved);
    }

    private UUID parseDocId(String docId) {
        try {
            return UUID.fromString(docId);
        } catch (IllegalArgumentException ignored) {
            // Preserve compatibility with numeric document IDs by mapping them into stable UUIDs.
            return UUID.nameUUIDFromBytes(("doc-" + docId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
    }

    private String authenticationNameFromHeader(String authorizationHeader) {
        return authorizationHeader == null ? "unknown" : "authenticated";
    }
}
