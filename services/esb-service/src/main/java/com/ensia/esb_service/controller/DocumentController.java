package com.ensia.esb_service.controller;

import org.springframework.integration.support.MessageBuilder;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.PollableChannel;
import org.springframework.web.bind.annotation.*;

@RestController
public class DocumentController {

    private final MessageChannel requestChannel;
    private final PollableChannel replyChannel;

    public DocumentController(
            MessageChannel requestChannel,
            PollableChannel replyChannel
    ) {
        this.requestChannel = requestChannel;
        this.replyChannel = replyChannel;
    }

    @GetMapping("/document/{id}")
    public Object getDocument(@PathVariable Long id) {

        requestChannel.send(
                MessageBuilder.withPayload(id).build()
        );

        return replyChannel.receive().getPayload();

    }

}