package com.ensia.auth_service.user;

import java.util.ArrayList;
import java.util.List;

public class UpdateUserRoleRequest {

    private String role;
    private List<String> roles = new ArrayList<>();

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public List<String> getRoles() {
        return roles;
    }

    public void setRoles(List<String> roles) {
        this.roles = roles;
    }
}
