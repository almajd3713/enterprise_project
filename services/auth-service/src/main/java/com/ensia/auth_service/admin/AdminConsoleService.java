package com.ensia.auth_service.admin;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.json.JsonParser;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class AdminConsoleService {
    private static final List<String> AVAILABLE_SERVICES = List.of(
            "gateway",
            "auth-service",
            "documents",
            "comments",
            "audit-service",
            "search-service",
            "translator-service",
            "kafka",
            "zookeeper",
            "postgres",
            "auth-postgres",
            "audit-postgres",
            "search-postgres",
            "redis",
            "minio",
            "cassandra",
            "prometheus",
            "grafana",
            "loki",
            "promtail"
    );

    private final RestTemplate restTemplate;
    private final JsonParser jsonParser;
    private final String lokiUrl;

    public AdminConsoleService(
            @Value("${app.observability.loki-url:http://localhost:3100}") String lokiUrl
    ) {
        this.restTemplate = new RestTemplate();
        this.jsonParser = JsonParserFactory.getJsonParser();
        this.lokiUrl = lokiUrl;
    }

    public AdminConsoleResponse fetchLogs(List<String> requestedServices, int requestedLimit) {
        int limit = Math.max(50, Math.min(requestedLimit, 2000));
        List<String> selectedServices = resolveServices(requestedServices);
        int perServiceLimit = Math.max(20, Math.min(500, limit / Math.max(1, selectedServices.size())));
        List<ConsoleLogEntry> all = new ArrayList<>();
        for (String service : selectedServices) {
            all.addAll(queryServiceLogs(service, perServiceLimit));
        }
        all.sort(Comparator.comparing(ConsoleLogEntry::timestampNs).reversed());
        if (all.size() > limit) {
            all = new ArrayList<>(all.subList(0, limit));
        }
        return new AdminConsoleResponse(AVAILABLE_SERVICES, selectedServices, all);
    }

    private List<String> resolveServices(List<String> requestedServices) {
        if (requestedServices == null || requestedServices.isEmpty()) {
            return AVAILABLE_SERVICES;
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String raw : requestedServices) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String value = raw.trim().toLowerCase(Locale.ROOT);
            for (String candidate : AVAILABLE_SERVICES) {
                if (candidate.equalsIgnoreCase(value)) {
                    normalized.add(candidate);
                    break;
                }
            }
        }
        return normalized.isEmpty() ? AVAILABLE_SERVICES : new ArrayList<>(normalized);
    }

    private List<ConsoleLogEntry> queryServiceLogs(String service, int limit) {
        List<ConsoleLogEntry> entries = new ArrayList<>();
        String query = "{service=\"" + service + "\"} or {container=~\".*" + service + ".*\"}";
        String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
        long endNs = System.currentTimeMillis() * 1_000_000L;
        long startNs = endNs - (6L * 60L * 60L * 1_000_000_000L);
        String url = String.format(
                "%s/loki/api/v1/query_range?query=%s&limit=%d&direction=backward&start=%d&end=%d",
                lokiUrl,
                encoded,
                limit,
                startNs,
                endNs
        );
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return entries;
            }
            Object parsed = jsonParser.parseMap(response.getBody());
            if (!(parsed instanceof Map<?, ?> root)) {
                return entries;
            }
            Object dataObj = root.get("data");
            if (!(dataObj instanceof Map<?, ?> data)) {
                return entries;
            }
            Object resultObj = data.get("result");
            if (!(resultObj instanceof List<?> results)) {
                return entries;
            }

            for (Object streamObj : results) {
                if (!(streamObj instanceof Map<?, ?> streamNode)) {
                    continue;
                }
                String stream = extractStringFromNestedMap(streamNode, "stream", "stream");
                String container = extractStringFromNestedMap(streamNode, "stream", "container");
                Object valuesObj = streamNode.get("values");
                if (!(valuesObj instanceof List<?> values)) {
                    continue;
                }
                for (Object valueObj : values) {
                    if (!(valueObj instanceof List<?> value) || value.size() < 2) {
                        continue;
                    }
                    String timestampNs = String.valueOf(value.get(0));
                    String line = String.valueOf(value.get(1));
                    entries.add(new ConsoleLogEntry(
                            service,
                            timestampNs,
                            toIso(timestampNs),
                            stream,
                            container,
                            line
                    ));
                }
            }
        } catch (Exception ignored) {
            // Failing one service should not break the whole console response.
        }
        return entries;
    }

    private String extractStringFromNestedMap(Map<?, ?> source, String parent, String child) {
        Object parentObj = source.get(parent);
        if (!(parentObj instanceof Map<?, ?> nested)) {
            return "";
        }
        Object value = nested.get(child);
        return value == null ? "" : String.valueOf(value);
    }

    private String toIso(String timestampNs) {
        try {
            long ns = Long.parseLong(timestampNs);
            long seconds = ns / 1_000_000_000L;
            long nanos = ns % 1_000_000_000L;
            return Instant.ofEpochSecond(seconds, nanos).toString();
        } catch (Exception ex) {
            return "";
        }
    }
}
