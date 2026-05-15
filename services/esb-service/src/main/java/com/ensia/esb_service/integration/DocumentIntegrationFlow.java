package com.ensia.esb_service.integration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.messaging.Message;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class DocumentIntegrationFlow {

    private final RestTemplate restTemplate;

    public DocumentIntegrationFlow(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Bean
    public IntegrationFlow documentFlow() {

        return IntegrationFlow
                .from("requestChannel")

                .handle(Message.class, (message, headers) -> {

                    Long id = (Long) message.getPayload();

                    // call Document service
                    Object document =
                            restTemplate.getForObject(
                                    "http://localhost:8081/documents/get/" + id,
                                    Object.class
                            );

                    Object comments;

                    try {

                        // call Comments service
                        comments =
                                restTemplate.getForObject(
                                        "http://localhost:8083/comments/list/" + id,
                                        Object.class
                                );

                    } catch (Exception e) {

                        // prioritize availability
                        comments = new Object[]{};

                    }

                    Map<String, Object> result = new HashMap<>();

                    result.put("document", document);
                    result.put("comments", comments);

                    return result;

                })

                .channel("replyChannel")
                .get();

    }

}