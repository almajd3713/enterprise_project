package com.ensia.auth_service.user;

import java.time.Instant;
import java.util.List;
import java.util.Set;

public record UserResponse(
        Long id,
        String username,
        String email,
        String role,
        List<String> roles,
        Set<Long> departmentIds,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        Instant lastLoginAt,
        Instant lastLogoutAt
) {
    public static UserResponse from(UserAccount account) {
        return new UserResponse(
                account.getId(),
                account.getUsername(),
                account.getEmail(),
                account.getRole().name(),
                account.getRoles().stream().map(UserRole::name).toList(),
                account.getDepartmentIds(),
                account.isActive(),
                account.getCreatedAt(),
                account.getUpdatedAt(),
                account.getLastLoginAt(),
                account.getLastLogoutAt()
        );
    }
}
