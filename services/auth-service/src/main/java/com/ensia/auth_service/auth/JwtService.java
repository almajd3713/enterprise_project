package com.ensia.auth_service.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collection;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

	private final AuthProperties authProperties;

	public JwtService(AuthProperties authProperties) {
		this.authProperties = authProperties;
	}

	public String generateToken(String username, Collection<String> roles) {
		return generateToken(username, roles, java.util.Set.of());
	}

	public String generateToken(String username, Collection<String> roles, Collection<Long> departmentIds) {
		Instant now = Instant.now();
		Instant expiresAt = now.plusSeconds(authProperties.getTokenTtlSeconds());
		String primaryRole = roles.stream().findFirst().orElse("USER");

		return Jwts.builder()
				.subject(username)
				.claim("role", primaryRole)
				.claim("roles", roles.stream().toList())
				.claim("departmentIds", departmentIds == null ? java.util.List.of() : departmentIds.stream().toList())
				.issuedAt(Date.from(now))
				.expiration(Date.from(expiresAt))
				.signWith(getSigningKey())
				.compact();
	}

	public Claims parseClaims(String token) {
		return Jwts.parser()
				.verifyWith(getSigningKey())
				.build()
				.parseSignedClaims(token)
				.getPayload();
	}

	private SecretKey getSigningKey() {
		byte[] secret = authProperties.getJwtSecret().getBytes(StandardCharsets.UTF_8);
		return Keys.hmacShaKeyFor(secret);
	}
}
