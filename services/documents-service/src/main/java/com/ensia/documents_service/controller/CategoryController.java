package com.ensia.documents_service.controller;

import com.ensia.documents_service.model.Category;
import com.ensia.documents_service.repository.CategoryRepository;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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

    @PatchMapping("/{categoryId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateCategory(@PathVariable Long categoryId, @RequestBody Category request) {
        String name = request == null || request.getName() == null ? "" : request.getName().trim();
        if (name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "name is required"));
        }

        Optional<Category> existing = categoryRepository.findById(categoryId);
        if (existing.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Category not found"));
        }

        if (categoryRepository.existsByNameIgnoreCase(name)
                && !name.equalsIgnoreCase(existing.get().getName())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Category already exists"));
        }

        Category category = existing.get();
        category.setName(name);
        return ResponseEntity.ok(categoryRepository.save(category));
    }

    @DeleteMapping("/{categoryId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteCategory(@PathVariable Long categoryId) {
        Optional<Category> existing = categoryRepository.findById(categoryId);
        if (existing.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Category not found"));
        }
        categoryRepository.delete(existing.get());
        return ResponseEntity.ok(Map.of("message", "Category deleted"));
    }
}
