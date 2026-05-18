package com.ensia.documents_service.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class DownloadLinkTokenService {
    private static final String TOKEN_TYPE = "document-download";

    private final String jwtSecret;
    private final int expiryMinutes;

    public DownloadLinkTokenService(
            @Value("${app.auth.jwt-secret}") String jwtSecret,
            @Value("${app.download-link.expiry-minutes:10}") int expiryMinutes
    ) {
        this.jwtSecret = jwtSecret;
        this.expiryMinutes = expiryMinutes;
    }

    public String createToken(Long documentId, String username, String sessionId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .claim("docId", documentId)
                .claim("sid", sessionId)
                .claim("tokenType", TOKEN_TYPE)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expiryMinutes, ChronoUnit.MINUTES)))
                .signWith(getSigningKey())
                .compact();
    }

    public int expiryMinutes() {
        return expiryMinutes;
    }

    public Claims parseAndValidate(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        Object tokenType = claims.get("tokenType");
        if (!TOKEN_TYPE.equals(tokenType)) {
            throw new io.jsonwebtoken.JwtException("Invalid token type");
        }
        return claims;
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }
}
