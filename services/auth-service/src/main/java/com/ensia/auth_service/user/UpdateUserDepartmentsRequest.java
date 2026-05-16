package com.ensia.auth_service.user;

import java.util.ArrayList;
import java.util.List;

public class UpdateUserDepartmentsRequest {

    private List<Long> departmentIds = new ArrayList<>();

    public List<Long> getDepartmentIds() {
        return departmentIds;
    }

    public void setDepartmentIds(List<Long> departmentIds) {
        this.departmentIds = departmentIds;
    }
}
