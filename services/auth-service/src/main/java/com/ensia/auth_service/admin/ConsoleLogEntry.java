package com.ensia.auth_service.admin;

public record ConsoleLogEntry(
        String service,
        String timestampNs,
        String timestampIso,
        String stream,
        String container,
        String line
) {
}
