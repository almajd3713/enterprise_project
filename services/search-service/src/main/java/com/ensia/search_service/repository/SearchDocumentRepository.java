package com.ensia.search_service.repository;

import com.ensia.search_service.model.SearchDocument;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SearchDocumentRepository extends JpaRepository<SearchDocument, Long> {

    @Query("""
        select d from SearchDocument d
        where (:departmentIdsEmpty = true or d.departmentId in :departmentIds)
          and (:departmentId is null or d.departmentId = :departmentId)
          and (:categoryId is null or d.categoryId = :categoryId)
          and (
            :query is null or :query = ''
            or lower(coalesce(d.title, '')) like lower(concat('%', :query, '%'))
            or lower(coalesce(d.description, '')) like lower(concat('%', :query, '%'))
            or lower(coalesce(d.translatedText, '')) like lower(concat('%', :query, '%'))
            or lower(coalesce(d.translatedDescription, '')) like lower(concat('%', :query, '%'))
            or lower(coalesce(d.fileName, '')) like lower(concat('%', :query, '%'))
          )
        order by d.updatedAt desc
    """)
    List<SearchDocument> search(
            @Param("query") String query,
            @Param("departmentIds") Collection<Long> departmentIds,
            @Param("departmentIdsEmpty") boolean departmentIdsEmpty,
            @Param("departmentId") Long departmentId,
            @Param("categoryId") Long categoryId
    );
}
