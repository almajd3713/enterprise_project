export default function CommentsTab({
  commentDocId, setCommentDocId,
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
}) {
  const canWrite = String(role).toLowerCase() === 'admin' || String(role).toLowerCase() === 'operator'

  return (
    <section className="panel-grid two">
      <article className="panel">
        <h2>{canWrite ? 'Add Comment' : 'View Comments'}</h2>
        
        {canWrite && (
          <form onSubmit={handleAddComment} className="stack">
            <label className="field">
              <span>Document ID</span>
              <input
                value={commentDocId}
                onChange={(e) => setCommentDocId(e.target.value)}
                placeholder="Document id"
              />
            </label>
            <label className="field">
              <span>Comment text</span>
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                rows={5}
                placeholder="Write a comment"
              />
            </label>
            <button className="btn" type="submit">Add Comment</button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => loadCommentsForDoc(commentDocId)}
            >
              {loadingComments ? 'Loading...' : 'Refresh Comments'}
            </button>
          </form>
        )}

        {!canWrite && (
          <div className="stack">
            <label className="field">
              <span>Document ID</span>
              <input
                value={commentDocId}
                onChange={(e) => setCommentDocId(e.target.value)}
                placeholder="Document id"
              />
            </label>
            <button
              className="btn secondary"
              type="button"
              onClick={() => loadCommentsForDoc(commentDocId)}
            >
              {loadingComments ? 'Loading...' : 'Load Comments'}
            </button>
          </div>
        )}
      </article>

      <article className="panel">
        <div className="panel-head">
          <h2>Moderation Queue</h2>
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
                <th>ID</th><th>Doc ID</th><th>Content</th><th>Flag</th>
              </tr>
            </thead>
            <tbody>
              {comments.length === 0 ? (
                <tr><td colSpan={4}>No comments available for this document id.</td></tr>
              ) : filteredComments.length === 0 ? (
                <tr><td colSpan={4}>No comments match the current moderation filters.</td></tr>
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
