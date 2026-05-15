package com.ensia.comments_service.repository;

import com.ensia.comments_service.model.Comment;
import org.springframework.data.cassandra.repository.CassandraRepository;

import java.util.List;
import java.util.UUID;
import com.ensia.comments_service.model.CommentKey;

public interface CommentRepository extends CassandraRepository<Comment, CommentKey> {

    List<Comment> findByKeyDocId(UUID docId);
}
