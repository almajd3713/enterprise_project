package com.ensia.comments_service.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ensia.comments_service.audit.AuditEventPublisher;
import com.ensia.comments_service.model.Comment;
import com.ensia.comments_service.repository.CommentRepository;
import com.ensia.comments_service.service.DocumentAccessService;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class CommentControllerTest {

    @Mock
    private CommentRepository repository;

    @Mock
    private DocumentAccessService documentAccessService;

    @Mock
    private AuditEventPublisher auditEventPublisher;

    private CommentController controller;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        controller = new CommentController(repository, documentAccessService, auditEventPublisher);
    }

    @Test
    void addCommentIsForbiddenWhenDocumentIsNotAccessible() {
        when(documentAccessService.canAccessDocument("123", "Bearer token")).thenReturn(false);

        Comment comment = new Comment();
        comment.setDocId("123");
        comment.setContent("Should fail");

        ResponseEntity<?> response = controller.addComment(comment, "Bearer token", null);

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(repository, never()).save(any());
        verify(auditEventPublisher, never()).publish(any(), any(), any(), any(), any());
    }

    @Test
    void listCommentsIsForbiddenWhenDocumentIsNotAccessible() {
        when(documentAccessService.canAccessDocument("123", "Bearer token")).thenReturn(false);

        ResponseEntity<?> response = controller.getComments("123", "Bearer token");

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(repository, never()).findByKeyDocId(any());
    }

    @Test
    void updateCommentIsForbiddenWhenDocumentIsNotAccessible() {
        when(documentAccessService.canAccessDocument("123", "Bearer token")).thenReturn(false);

        ResponseEntity<?> response = controller.updateComment(
                "123",
                "550e8400-e29b-41d4-a716-446655440000",
                Map.of("content", "Blocked"),
                "Bearer token",
                null
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        verify(repository, never()).save(any());
    }
}
