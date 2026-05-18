package com.ensia.auth_service.admin;

import java.util.List;

public record AdminConsoleResponse(
        List<String> availableServices,
        List<String> selectedServices,
        List<ConsoleLogEntry> entries
) {
}
