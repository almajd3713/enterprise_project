package com.ensia.auth_service.auth;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public class AuthProperties {

	private String jwtSecret;
	private long tokenTtlSeconds = 3600;
	private List<UserEntry> users = new ArrayList<>();

	public String getJwtSecret() {
		return jwtSecret;
	}

	public void setJwtSecret(String jwtSecret) {
		this.jwtSecret = jwtSecret;
	}

	public long getTokenTtlSeconds() {
		return tokenTtlSeconds;
	}

	public void setTokenTtlSeconds(long tokenTtlSeconds) {
		this.tokenTtlSeconds = tokenTtlSeconds;
	}

	public List<UserEntry> getUsers() {
		return users;
	}

	public void setUsers(List<UserEntry> users) {
		this.users = users;
	}

	public static class UserEntry {

		private String username;
		private String email;
		private String password;
		private List<String> roles = new ArrayList<>();

		public String getUsername() {
			return username;
		}

		public void setUsername(String username) {
			this.username = username;
		}

		public String getEmail() {
			return email;
		}

		public void setEmail(String email) {
			this.email = email;
		}

		public String getPassword() {
			return password;
		}

		public void setPassword(String password) {
			this.password = password;
		}

		public List<String> getRoles() {
			return roles;
		}

		public void setRoles(List<String> roles) {
			this.roles = roles;
		}
	}
}