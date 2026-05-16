package com.ensia.auth_service.user;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
}
