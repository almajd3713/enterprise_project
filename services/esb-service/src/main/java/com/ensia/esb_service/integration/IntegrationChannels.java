package com.ensia.esb_service.integration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.messaging.MessageChannel;
import org.springframework.integration.channel.QueueChannel;

@Configuration
public class IntegrationChannels {

    @Bean
    public MessageChannel requestChannel() {
        return new DirectChannel();
    }

    @Bean
    public QueueChannel replyChannel() {
        return new QueueChannel();
    }

}