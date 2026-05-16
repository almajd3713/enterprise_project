package com.ensia.auth_service.auth;

import com.ensia.auth_service.user.UserAccount;
import com.ensia.auth_service.user.UserAccountService;
import com.ensia.auth_service.user.UserRole;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserAccountService userAccountService;

    public AuthController(AuthenticationManager authenticationManager,
                          JwtService jwtService,
                          UserAccountService userAccountService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userAccountService = userAccountService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        String login = resolveLogin(request);
        if (login == null || request.getPassword() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(java.util.Map.of("message", "username and password are required"));
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(login, request.getPassword())
            );

            String username = authentication.getName();
            UserAccount account = userAccountService.getByUsername(username);
            Set<String> roles = account.getRoles().stream()
                    .map(UserRole::name)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            String normalizedRole = account.getRole().name().toUpperCase(Locale.ROOT);
            userAccountService.markLogin(username);

            java.util.List<Long> departmentIds = account.getDepartments().stream().map(com.ensia.auth_service.user.Department::getId).toList();
            String token = jwtService.generateToken(username, roles, departmentIds);
            return ResponseEntity.ok(new LoginResponse(
                    token,
                    username,
                    normalizedRole,
                    roles.stream().toList(),
                    RolePermissions.forRoles(roles.stream().toList())
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(java.util.Map.of("message", "Invalid username or password"));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody com.ensia.auth_service.user.CreateUserRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(userAccountService.create(request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(java.util.Map.of("message", "Unauthorized"));
        }

        userAccountService.markLogout(authentication.getName());
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(java.util.Map.of("message", "Logged out"));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(java.util.Map.of("message", "Unauthorized"));
        }

        UserAccount account = userAccountService.getByUsername(authentication.getName());
        return ResponseEntity.ok(java.util.Map.of(
                "username", account.getUsername(),
                "email", account.getEmail(),
                "active", account.isActive(),
                "lastLoginAt", account.getLastLoginAt(),
                "lastLogoutAt", account.getLastLogoutAt(),
                "role", account.getRole().name().toUpperCase(Locale.ROOT),
                "roles", account.getRoles().stream().map(UserRole::name).toList(),
                "departmentIds", account.getDepartments().stream().map(com.ensia.auth_service.user.Department::getId).toList(),
                "departments", account.getDepartments().stream().map(com.ensia.auth_service.user.Department::getName).toList(),
                "permissions", RolePermissions.forRoles(account.getRoles().stream().map(UserRole::name).toList())
        ));
    }

    private String resolveLogin(LoginRequest request) {
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            return request.getUsername().trim();
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            return request.getEmail().trim();
        }
        return null;
    }
}
