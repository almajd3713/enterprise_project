package com.ensia.documents_service;

import static org.assertj.core.api.Assertions.assertThatCode;

import com.ensia.documents_service.model.Document;
import com.ensia.documents_service.repository.DocumentRepository;
import com.ensia.documents_service.security.JwtAuthenticationFilter;
import com.ensia.documents_service.security.JwtService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
        "app.auth.jwt-secret=change-this-for-production-and-use-a-strong-key-please-1234567890",
        "app.kafka.enabled=false",
        "app.kafka.listener.auto-startup=false",
        "spring.cache.type=simple"
})
@AutoConfigureMockMvc
@Import({com.ensia.documents_service.security.SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class})
class DocumentSecurityIntegrationTest {

    private static final String SECRET = "change-this-for-production-and-use-a-strong-key-please-1234567890";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DocumentRepository documentRepository;

    @BeforeEach
    void setup() {
        documentRepository.deleteAll();
    }

    @Test
    void anonymousRequestsAreRejected() {
        assertThatCode(() -> mockMvc.perform(get("/documents/list"))
                .andExpect(status().isUnauthorized()))
                .doesNotThrowAnyException();
    }

    @Test
    void tamperedTokensAreRejected() {
        assertThatCode(() -> mockMvc.perform(get("/documents/list")
                        .header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isUnauthorized()))
                .doesNotThrowAnyException();
    }

    @Test
    void documentGetIsForbiddenForUsersOutsideDepartment() {
        Document document = new Document();
        document.setTitle("IT-only");
        document.setDepartmentId(42L);
        document.setOwnerId("alice");
        Document saved = documentRepository.save(document);

        String token = createToken("bob", "USER", java.util.List.of(10L));
        assertThatCode(() -> mockMvc.perform(get("/documents/get/" + saved.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden()))
                .doesNotThrowAnyException();
    }

    @Test
    void documentGetReturnsNotFoundForMissingDocument() {
        String token = createToken("bob", "USER", java.util.List.of(10L));
        assertThatCode(() -> mockMvc.perform(get("/documents/get/999999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound()))
                .doesNotThrowAnyException();
    }

    private String createToken(String username, String role) {
        return createToken(username, role, java.util.List.of());
    }

    private String createToken(String username, String role, java.util.List<Long> departmentIds) {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .claim("roles", java.util.List.of(role))
                .claim("departmentIds", departmentIds)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(3600)))
                .signWith(key)
                .compact();
    }
}
