package com.ensia.auth_service.auth;

import java.util.List;

public class LoginResponse {

	private final String token;
	private final String username;
	private final String role;
	private final List<String> roles;
	private final List<String> permissions;

	public LoginResponse(String token, String username, String role, List<String> roles, List<String> permissions) {
		this.token = token;
		this.username = username;
		this.role = role;
		this.roles = roles;
		this.permissions = permissions;
	}

	public String getToken() {
		return token;
	}

	public String getUsername() {
		return username;
	}

	public String getRole() {
		return role;
	}

	public List<String> getRoles() {
		return roles;
	}

	public List<String> getPermissions() {
		return permissions;
	}
}