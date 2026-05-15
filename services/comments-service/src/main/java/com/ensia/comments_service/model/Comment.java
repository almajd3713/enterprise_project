package com.ensia.comments_service.model;

import org.springframework.data.annotation.Transient;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

@Table("comments")
public class Comment {

    @PrimaryKey
    private CommentKey key;

    @Transient
    private String docId;

    private String content;

    private String author;

    public Comment() {
    }

    public Comment(CommentKey key, String docId, String content, String author) {
        this.key = key;
        this.docId = docId;
        this.content = content;
        this.author = author;
    }

    public CommentKey getKey() {
        return key;
    }

    public void setKey(CommentKey key) {
        this.key = key;
    }

    public String getDocId() {
        return docId;
    }

    public void setDocId(String docId) {
        this.docId = docId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }
}
