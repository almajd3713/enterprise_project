package com.ensia.comments_service.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
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
            ResponseEntity<Void> response = restClient.get()
                    .uri(documentsServiceUrl + "/documents/get/" + documentId)
                    .header(HttpHeaders.AUTHORIZATION, authorizationHeader)
                    .retrieve()
                    .toBodilessEntity();
            return response.getStatusCode().is2xxSuccessful();
        } catch (org.springframework.web.client.HttpStatusCodeException ex) {
            return false;
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
