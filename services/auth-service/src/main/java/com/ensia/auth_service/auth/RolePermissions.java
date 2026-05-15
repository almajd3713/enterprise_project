package com.ensia.auth_service.auth;

import java.util.List;
import java.util.Map;

public final class RolePermissions {

	private RolePermissions() {
	}

	private static final Map<String, List<String>> PERMISSIONS = Map.of(
			"ADMIN", List.of("overview", "documents", "comments", "gateway", "analytics", "operations", "logs", "users", "settings", "audit"),
			"OPERATOR", List.of("overview", "documents", "comments", "gateway", "analytics", "operations", "logs", "audit"),
			"ANALYST", List.of("overview", "documents", "comments", "analytics"),
			"USER", List.of("overview", "documents")
	);

	public static List<String> forRole(String role) {
		return PERMISSIONS.getOrDefault(role, List.of());
	}

	public static List<String> forRoles(List<String> roles) {
		return roles.stream()
				.flatMap(role -> forRole(role).stream())
				.distinct()
				.toList();
	}
}