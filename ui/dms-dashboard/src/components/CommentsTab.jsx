import { useEffect, useMemo, useState } from 'react'

export default function CommentsTab({
  documents,
  setCommentDocId,
  commentDocId,
  commentContent, setCommentContent,
  commentQuery, setCommentQuery,
  commentFlagFilter, setCommentFlagFilter,
  commentSortBy, setCommentSortBy,
  commentSortDir, setCommentSortDir,
  comments, filteredComments, loadingComments, flaggedCount,
  moderationState, toggleFlag,
  clearCommentFilters,
  handleAddComment,
  loadCommentsForDoc,
  role,
  enforceDepartmentScope,
  handleUpdateComment,
  handleDeleteComment,
}) {
  const canWrite = String(role).toLowerCase() === 'admin' || String(role).toLowerCase() === 'operator'
  const hasSelection = Boolean(commentDocId)
  const commentLength = commentContent.trim().length
  const [docQuery, setDocQuery] = useState('')
  const [debouncedDocQuery, setDebouncedDocQuery] = useState('')
  const [docDepartmentFilter, setDocDepartmentFilter] = useState('all')
  const [docFileFilter, setDocFileFilter] = useState('all')
  const [showDocSuggestions, setShowDocSuggestions] = useState(false)
  const [recentDocIds, setRecentDocIds] = useState([])
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentContent, setEditingCommentContent] = useState('')
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDocQuery(docQuery.trim().toLowerCase()), 250)
    return () => clearTimeout(timer)
  }, [docQuery])

  function selectDocument(docId) {
    const nextId = String(docId || '')
    setCommentDocId(nextId)
    const selected = documents.find((doc) => String(doc.id) === nextId)
    if (selected) {
      setDocQuery(`#${selected.id} ${selected.title || '(untitled)'}`)
    }
    setShowDocSuggestions(false)
    if (!nextId) return
    setRecentDocIds((prev) => {
      const next = [nextId, ...prev.filter((id) => id !== nextId)]
      return next.slice(0, 5)
    })
  }

  const departmentOptions = useMemo(() => {
    const ids = Array.from(new Set(documents.map((doc) => Number(doc.departmentId)).filter((id) => Number.isFinite(id))))
    return ids.sort((a, b) => a - b)
  }, [documents])

  const filteredDocCandidates = useMemo(() => {
    const next = documents.filter((doc) => {
      const matchesQuery =
        !debouncedDocQuery ||
        [String(doc.id), doc.title, doc.fileName].some((field) =>
          String(field || '').toLowerCase().includes(debouncedDocQuery),
        )
      const matchesDepartment =
        docDepartmentFilter === 'all' || String(doc.departmentId) === String(docDepartmentFilter)
      const hasFile = Boolean(String(doc.fileName || '').trim())
      const matchesFile =
        docFileFilter === 'all' ||
        (docFileFilter === 'withFile' && hasFile) ||
        (docFileFilter === 'withoutFile' && !hasFile)
      return matchesQuery && matchesDepartment && matchesFile
    })
    return next.slice(0, 20)
  }, [documents, debouncedDocQuery, docDepartmentFilter, docFileFilter])

  const selectedDoc = useMemo(
    () => documents.find((doc) => String(doc.id) === String(commentDocId)) || null,
    [documents, commentDocId],
  )

  const recentDocuments = useMemo(
    () =>
      recentDocIds
        .map((id) => documents.find((doc) => String(doc.id) === String(id)))
        .filter(Boolean),
    [recentDocIds, documents],
  )

  return (
    <section className="panel-grid two">
      <article className="panel">
        <h2>Document Context</h2>
        <label className="field top-gap">
          <span>Find Document</span>
          <input
            value={docQuery}
            onChange={(e) => {
              setDocQuery(e.target.value)
              setShowDocSuggestions(true)
            }}
            onFocus={() => setShowDocSuggestions(true)}
            placeholder="Search by id, title, or file name"
          />
        </label>
        {showDocSuggestions && filteredDocCandidates.length > 0 && (
          <div className="suggestions-list">
            {filteredDocCandidates.map((doc) => (
              <button
                key={`suggestion-${doc.id}`}
                className="suggestion-item"
                type="button"
                onClick={() => selectDocument(String(doc.id))}
              >
                <span><strong>#{doc.id}</strong> {doc.title || '(untitled)'}</span>
                <span className="small-note">Dept #{doc.departmentId ?? '-'} | {doc.fileName || 'No file'}</span>
              </button>
            ))}
          </div>
        )}
        <div className="toolbar-row">
          <label className="field inline compact">
            <span>Department</span>
            <select value={docDepartmentFilter} onChange={(e) => setDocDepartmentFilter(e.target.value)}>
              <option value="all">All</option>
              {departmentOptions.map((id) => (
                <option key={`dep-${id}`} value={String(id)}>Department #{id}</option>
              ))}
            </select>
          </label>
          <label className="field inline compact">
            <span>File</span>
            <select value={docFileFilter} onChange={(e) => setDocFileFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="withFile">With file</option>
              <option value="withoutFile">Without file</option>
            </select>
          </label>
          <button
            className="btn ghost compact"
            type="button"
            onClick={() => {
              setDocQuery('')
              setCommentDocId('')
              setShowDocSuggestions(false)
              setDocDepartmentFilter('all')
              setDocFileFilter('all')
            }}
          >
            Reset Picker
          </button>
        </div>

        <p className="small-note">
          {hasSelection
            ? `Selected document #${commentDocId}`
            : 'Select a document above to activate comments workflows.'}
        </p>
        {selectedDoc && (
          <div className="admin-mgmt-card top-gap">
            <p><strong>Selected:</strong> #{selectedDoc.id} {selectedDoc.title || '(untitled)'}</p>
            <p className="small-note">
              Department #{selectedDoc.departmentId ?? '-'} | Category #{selectedDoc.categoryId ?? '-'} | {selectedDoc.fileName || 'No file'}
            </p>
          </div>
        )}
        {enforceDepartmentScope && (
          <p className="small-note">
            Department scope is active. You can comment only on documents visible to your scope.
          </p>
        )}

        {canWrite && (
          <form onSubmit={handleAddComment} className="stack">
            <label className="field">
              <span>Comment text</span>
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                rows={5}
                placeholder="Write a comment"
                disabled={!hasSelection}
              />
            </label>
            <p className="small-note">Length: {commentLength} characters</p>
            <div className="toolbar-row">
              <button className="btn" type="submit" disabled={!hasSelection}>Add Comment</button>
              <button className="btn ghost" type="button" onClick={() => setCommentContent('')} disabled={!commentContent}>
                Clear
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={!hasSelection}
                onClick={() => loadCommentsForDoc(commentDocId)}
              >
                {loadingComments ? 'Loading...' : 'Refresh Comments'}
              </button>
            </div>
          </form>
        )}

        {!canWrite && (
          <div className="stack">
            <button
              className="btn secondary"
              type="button"
              disabled={!hasSelection}
              onClick={() => loadCommentsForDoc(commentDocId)}
            >
              {loadingComments ? 'Loading...' : 'Load Comments'}
            </button>
          </div>
        )}

        {recentDocuments.length > 0 && (
          <>
            <p className="small-note top-gap">Recent documents</p>
            <div className="chip-row">
              {recentDocuments.map((doc) => (
                <button
                  key={`comment-doc-${doc.id}`}
                  type="button"
                  className={String(doc.id) === String(commentDocId) ? 'chip flagged' : 'chip action'}
                  onClick={() => selectDocument(String(doc.id))}
                >
                  #{doc.id} {doc.title || 'Untitled'}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="small-note top-gap">
          Picker results shown: {filteredDocCandidates.length} (capped to 20 for speed).
        </p>
      </article>

      <article className="panel">
        <div className="panel-head">
          <h2>Comments & Moderation</h2>
          <p className="result-meta">
            Showing {filteredComments.length} of {comments.length} comments | Flagged: {flaggedCount}
          </p>
        </div>

        <div className="toolbar-row">
          <label className="field inline compact grow">
            <span>Search</span>
            <input
              value={commentQuery}
              onChange={(e) => setCommentQuery(e.target.value)}
              placeholder="Search by id, doc id, or content"
            />
          </label>
          <label className="field inline compact">
            <span>Flag Filter</span>
            <select value={commentFlagFilter} onChange={(e) => setCommentFlagFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="flagged">Flagged</option>
              <option value="clean">Clean</option>
            </select>
          </label>
          <label className="field inline compact">
            <span>Sort By</span>
            <select value={commentSortBy} onChange={(e) => setCommentSortBy(e.target.value)}>
              <option value="id">ID</option>
              <option value="docId">Doc ID</option>
              <option value="content">Content</option>
            </select>
          </label>
          <label className="field inline compact">
            <span>Order</span>
            <select value={commentSortDir} onChange={(e) => setCommentSortDir(e.target.value)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <button className="btn ghost" type="button" onClick={clearCommentFilters}>Reset</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Doc ID</th><th>Content</th><th>Flag</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {comments.length === 0 ? (
                <tr><td colSpan={5}>No comments loaded yet for the selected document.</td></tr>
              ) : filteredComments.length === 0 ? (
                <tr><td colSpan={5}>No comments match the current moderation filters.</td></tr>
              ) : (
                filteredComments.map((comment) => (
                  <tr key={comment.id}>
                    <td>{comment.id}</td>
                    <td>{comment.docId}</td>
                    <td>{comment.content}</td>
                    <td>
                      <button
                        type="button"
                        className={moderationState[comment.id] ? 'chip flagged' : 'chip unflagged'}
                        onClick={() => toggleFlag(comment.id)}
                      >
                        {moderationState[comment.id] ? 'Flagged' : 'Clean'}
                      </button>
                    </td>
                    <td>
                      {editingCommentId === comment.id ? (
                        <>
                          <input
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                            placeholder="Comment content"
                          />
                          <button
                            className="chip action"
                            type="button"
                            onClick={() => handleUpdateComment({ ...comment, content: editingCommentContent })}
                          >
                            Save
                          </button>
                          <button className="chip action" type="button" onClick={() => setEditingCommentId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : pendingDeleteCommentId === comment.id ? (
                        <>
                          <button className="chip flagged action" type="button" onClick={() => handleDeleteComment(comment)}>
                            Confirm Delete
                          </button>
                          <button className="chip action" type="button" onClick={() => setPendingDeleteCommentId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="chip action"
                            type="button"
                            onClick={() => {
                              setEditingCommentId(comment.id)
                              setEditingCommentContent(comment.content || '')
                              setPendingDeleteCommentId(null)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="chip flagged action"
                            type="button"
                            onClick={() => {
                              setPendingDeleteCommentId(comment.id)
                              setEditingCommentId(null)
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}
