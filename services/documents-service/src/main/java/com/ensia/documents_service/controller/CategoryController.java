package com.ensia.documents_service.controller;

import com.ensia.documents_service.model.Category;
import com.ensia.documents_service.repository.CategoryRepository;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/documents/categories")
public class CategoryController {

    private final CategoryRepository categoryRepository;

    public CategoryController(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @GetMapping
    public ResponseEntity<?> listCategories() {
        return ResponseEntity.ok(categoryRepository.findAll());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createCategory(@RequestBody Category request) {
        String name = request == null || request.getName() == null ? "" : request.getName().trim();
        if (name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "name is required"));
        }
        if (categoryRepository.existsByNameIgnoreCase(name)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Category already exists"));
        }

        Category category = new Category();
        category.setName(name);
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryRepository.save(category));
    }
}
