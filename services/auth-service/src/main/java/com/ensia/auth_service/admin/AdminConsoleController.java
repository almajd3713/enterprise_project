package com.ensia.auth_service.admin;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/admin")
public class AdminConsoleController {

    private final AdminConsoleService adminConsoleService;

    public AdminConsoleController(AdminConsoleService adminConsoleService) {
        this.adminConsoleService = adminConsoleService;
    }

    @GetMapping("/console")
    public ResponseEntity<AdminConsoleResponse> console(
            @RequestParam(required = false) List<String> services,
            @RequestParam(defaultValue = "300") int limit
    ) {
        return ResponseEntity.ok(adminConsoleService.fetchLogs(services, limit));
    }
}
