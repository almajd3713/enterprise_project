package com.ensia.search_service.security;

import java.util.LinkedHashSet;
import java.util.Set;

public record AuthenticatedUser(String username, Set<String> roles, Set<Long> departmentIds) {

    public AuthenticatedUser {
        roles = roles == null ? Set.of() : new LinkedHashSet<>(roles);
        departmentIds = departmentIds == null ? Set.of() : new LinkedHashSet<>(departmentIds);
    }

    public boolean isAdmin() {
        return roles.contains("ADMIN");
    }
}
