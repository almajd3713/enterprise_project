package com.example.documents.controller;

import com.example.documents.model.Document;
import com.example.documents.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;

// In this code, the controller is having the business logic to 
// simplify the code but it is a violation of the MVC principles.

@RestController
@RequestMapping("/documents")
@RequiredArgsConstructor
public class DocumentController {

	@Autowired
	private final DocumentRepository documentRepository;

	@Autowired
	private final KafkaTemplate<String, Object> kafkaTemplate;

	@Value("${kafka.topic.documents-uploaded}")
	private String uploadedTopic;

	@GetMapping("/list")
	public List<Document> listDocuments() {
		return documentRepository.findAll();
	}

	@GetMapping("/get/{id}")
	public Document getDocument(@PathVariable Long id) {
		return documentRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Document not found with id: " + id));
	}

	@PostMapping("/add")
	@ResponseStatus(HttpStatus.CREATED)
	public Document addDocument(@RequestBody Map<String, String> request) {
		String title = request.get("title");
		if (title == null || title.isBlank()) {
			throw new IllegalArgumentException("Title is required");
		}
		Document doc = new Document();
		doc.setTitle(title.trim());
		Document savedDoc = documentRepository.save(doc);

		Map<String, Object> event = Map.of(
				"eventId", UUID.randomUUID().toString(),
				"eventType", "DocumentUploaded",
				"occurredAt", Instant.now().toString(),
				"documentId", savedDoc.getId(),
				"title", savedDoc.getTitle(),
				"textToTranslate", savedDoc.getTitle(),
				"sourceLanguage", "en",
				"targetLanguage", "fr"
		);
		kafkaTemplate.send(uploadedTopic, String.valueOf(savedDoc.getId()), event);

		return savedDoc;
	}

	@GetMapping("/delete")
	public Map<String, String> deleteDocument(@RequestParam Long id) {
		deleteById(id);
		return Map.of("message", "Document deleted with id: " + id);
	}

	@GetMapping("/delete/{id}")
	public Map<String, String> deleteDocumentByPath(@PathVariable Long id) {
		deleteById(id);
		return Map.of("message", "Document deleted with id: " + id);
	}

	@ResponseStatus(HttpStatus.NOT_FOUND)
	@org.springframework.web.bind.annotation.ExceptionHandler(NoSuchElementException.class)
	public Map<String, String> handleNotFound(NoSuchElementException ex) {
		return Map.of("error", ex.getMessage());
	}

	@ResponseStatus(HttpStatus.BAD_REQUEST)
	@org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
	public Map<String, String> handleBadRequest(IllegalArgumentException ex) {
		return Map.of("error", ex.getMessage());
	}

	private void deleteById(Long id) {
		if (!documentRepository.existsById(id)) {
			throw new NoSuchElementException("Document not found with id: " + id);
		}
		documentRepository.deleteById(id);
	}
}
