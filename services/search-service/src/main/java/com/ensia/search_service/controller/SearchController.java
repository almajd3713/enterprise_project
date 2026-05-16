package com.ensia.search_service.controller;

import com.ensia.search_service.model.SearchDocument;
import com.ensia.search_service.security.AuthenticatedUser;
import com.ensia.search_service.service.SearchIndexService;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/search")
public class SearchController {

    private final SearchIndexService searchIndexService;

    public SearchController(SearchIndexService searchIndexService) {
        this.searchIndexService = searchIndexService;
    }

    @GetMapping("/documents")
    public List<SearchDocument> searchDocuments(@RequestParam(required = false) String q,
                                                @RequestParam(required = false) Long departmentId,
                                                @RequestParam(required = false) Long categoryId,
                                                @RequestParam(required = false) String ownerId,
                                                Authentication authentication) {
        AuthenticatedUser user = requireUser(authentication);
        return searchIndexService.search(q, user.departmentIds(), user.isAdmin(), departmentId, categoryId, ownerId);
    }

    @GetMapping("/facets")
    public Map<String, Object> facets(Authentication authentication) {
        AuthenticatedUser user = requireUser(authentication);
        return searchIndexService.facets(user.departmentIds(), user.isAdmin());
    }

    private AuthenticatedUser requireUser(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return user;
        }
        return new AuthenticatedUser(authentication == null ? "unknown" : authentication.getName(), Set.of(), Set.of());
    }
}
