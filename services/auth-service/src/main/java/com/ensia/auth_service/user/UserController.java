package com.ensia.auth_service.user;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserAccountService userAccountService;

    public UserController(UserAccountService userAccountService) {
        this.userAccountService = userAccountService;
    }

    @GetMapping
    public ResponseEntity<?> listUsers(@RequestParam(required = false) String query,
                                       @RequestParam(required = false) String role,
                                       @RequestParam(required = false) String active) {
        return ResponseEntity.ok(userAccountService.list(query, role, active));
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(userAccountService.create(request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PatchMapping("/{userId}/role")
    public ResponseEntity<?> updateRole(@PathVariable Long userId,
                                        @RequestBody UpdateUserRoleRequest request) {
        try {
            return ResponseEntity.ok(userAccountService.updateRole(userId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PatchMapping("/{userId}/state")
    public ResponseEntity<?> updateState(@PathVariable Long userId,
                                         @RequestBody UpdateUserStateRequest request) {
        try {
            if (request.getActive() == null) {
                throw new IllegalArgumentException("active is required");
            }
            return ResponseEntity.ok(userAccountService.updateState(userId, request.getActive()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PatchMapping("/{userId}/departments")
    public ResponseEntity<?> updateDepartments(@PathVariable Long userId,
                                               @RequestBody UpdateUserDepartmentsRequest request) {
        try {
            return ResponseEntity.ok(userAccountService.updateDepartments(userId, request.getDepartmentIds()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/{userId}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable Long userId,
                                           @RequestBody ResetPasswordRequest request) {
        try {
            userAccountService.resetPassword(userId, request.getNewPassword());
            return ResponseEntity.ok(Map.of("message", "Password reset successful"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest request,
                                            Authentication authentication) {
        try {
            if (authentication == null || authentication.getName() == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Unauthorized"));
            }
            userAccountService.changePassword(authentication.getName(), request.getCurrentPassword(), request.getNewPassword());
            return ResponseEntity.ok(Map.of("message", "Password changed"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
