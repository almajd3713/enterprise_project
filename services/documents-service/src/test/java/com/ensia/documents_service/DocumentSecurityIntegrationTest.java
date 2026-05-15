package com.ensia.documents_service;

import static org.assertj.core.api.Assertions.assertThat;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
        "app.auth.jwt-secret=change-this-for-production-and-use-a-strong-key-please-1234567890",
        "app.kafka.enabled=false",
        "app.kafka.listener.auto-startup=false"
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
    void documentOwnerComesFromJwtIdentity() {
        String token = createToken("alice", "USER");
        assertThatCode(() -> mockMvc.perform(post("/documents/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + token)
                        .content("{\"title\":\"Quarterly Report\"}"))
                .andExpect(status().is2xxSuccessful()))
                .doesNotThrowAnyException();

        Document saved = documentRepository.findAll().stream().findFirst().orElseThrow();
        assertThat(saved.getOwnerId()).isEqualTo("alice");
    }

    private String createToken(String username, String role) {
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .claim("role", role)
                .claim("roles", java.util.List.of(role))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(3600)))
                .signWith(key)
                .compact();
    }
}
