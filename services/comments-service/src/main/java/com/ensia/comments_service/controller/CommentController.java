package com.ensia.comments_service.controller;

import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.ensia.comments_service.model.Comment;
import com.ensia.comments_service.model.CommentKey;
import com.ensia.comments_service.repository.CommentRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/comments")
public class CommentController {

    private final CommentRepository repository;

    public CommentController(CommentRepository repository) {
        this.repository = repository;
    }

    // ✅ GET comments/list/{docId}
    @GetMapping("/list/{docId}")
    public List<Comment> getComments(@PathVariable String docId) {
        return repository.findByKeyDocId(parseDocId(docId));
    }

    // ✅ POST comments/add
    @PostMapping("/add")
    public Comment addComment(@RequestBody Comment comment) {
        UUID docId;
        if (comment.getKey() != null && comment.getKey().getDocId() != null) {
            docId = comment.getKey().getDocId();
        } else if (comment.getDocId() != null && !comment.getDocId().isBlank()) {
            docId = parseDocId(comment.getDocId());
        } else {
            throw new IllegalArgumentException("key.docId or docId is required");
        }

        comment.setKey(new CommentKey(docId, Uuids.timeBased()));
        return repository.save(comment);
    }

    private UUID parseDocId(String docId) {
        try {
            return UUID.fromString(docId);
        } catch (IllegalArgumentException ignored) {
            // Preserve compatibility with numeric document IDs by mapping them into stable UUIDs.
            return UUID.nameUUIDFromBytes(("doc-" + docId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }
    }
}
