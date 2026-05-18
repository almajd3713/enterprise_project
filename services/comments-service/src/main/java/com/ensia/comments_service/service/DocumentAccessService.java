package com.ensia.comments_service.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class DocumentAccessService {

    private final RestClient restClient;
    private final String documentsServiceUrl;

    public DocumentAccessService(@Value("${documents.service.url}") String documentsServiceUrl) {
        this.documentsServiceUrl = documentsServiceUrl;
        this.restClient = RestClient.create();
    }

    public boolean canAccessDocument(String documentId, String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return false;
        }

        try {
            Object responseBody = restClient.get()
                    .uri(documentsServiceUrl + "/documents/get/" + documentId)
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .body(Object.class);
            return responseBody != null;
        } catch (org.springframework.web.client.HttpStatusCodeException ex) {
            return false;
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
