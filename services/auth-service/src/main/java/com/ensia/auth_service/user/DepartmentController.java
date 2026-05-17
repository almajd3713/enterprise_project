package com.ensia.auth_service.user;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final UserAccountService userAccountService;

    public DepartmentController(UserAccountService userAccountService) {
        this.userAccountService = userAccountService;
    }

    @GetMapping
    public ResponseEntity<?> listDepartments() {
        return ResponseEntity.ok(userAccountService.listDepartments());
    }

    @PostMapping
    public ResponseEntity<?> createDepartment(@RequestBody CreateDepartmentRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(userAccountService.createDepartment(request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @PatchMapping("/{departmentId}")
    public ResponseEntity<?> updateDepartment(@PathVariable Long departmentId,
                                              @RequestBody CreateDepartmentRequest request) {
        try {
            return ResponseEntity.ok(userAccountService.updateDepartment(departmentId, request));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/{departmentId}")
    public ResponseEntity<?> deleteDepartment(@PathVariable Long departmentId) {
        try {
            userAccountService.deleteDepartment(departmentId);
            return ResponseEntity.ok(Map.of("message", "Department deleted"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        }
    }
}
