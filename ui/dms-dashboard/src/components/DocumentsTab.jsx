export default function DocumentsTab({
  // data
  documents,
  filteredDocuments,
  loadingDocs,
  selectedDocumentId,
  setSelectedDocumentId,
  setCommentDocId,
  selectedDocumentDetails,
  loadingFull,
  // filters
  docFileFilter,
  setDocFileFilter,
  docSortBy,
  setDocSortBy,
  docSortDir,
  setDocSortDir,
  clearDocumentFilters,
  // forms
  newDocumentTitle,
  setNewDocumentTitle,
  newDocumentDepartmentId,
  setNewDocumentDepartmentId,
  newDocumentCategoryId,
  setNewDocumentCategoryId,
  newUploadTitle,
  setNewUploadTitle,
  newUploadDepartmentId,
  setNewUploadDepartmentId,
  newUploadCategoryId,
  setNewUploadCategoryId,
  setUploadFile,
  setReplaceFile,
  departments,
  categories,
  // presigned
  presignedUrlData,
  setPresignedUrlData,
  presignedUrlLoading,
  // handlers
  handleCreateDocument,
  handleUploadDocument,
  handleLoadFullDocument,
  handleReplaceFile,
  handleDownloadSelectedDocument,
  handleGetPresignedUrl,
  role,
}) {
  const canWrite = String(role).toLowerCase() === 'admin' || String(role).toLowerCase() === 'operator'
  return (
    <section className="panel-grid two">
      {/* ── Left: operations ─────────────────────────── */}
      <article className="panel">
        <h2>Document Operations</h2>

        {canWrite && (
          <form onSubmit={handleCreateDocument} className="stack">
            <label className="field">
              <span>Create metadata</span>
              <input
                value={newDocumentTitle}
                onChange={(e) => setNewDocumentTitle(e.target.value)}
                placeholder="Document title"
              />
            </label>
            <label className="field">
              <span>Department</span>
              <select value={newDocumentDepartmentId} onChange={(e) => setNewDocumentDepartmentId(e.target.value)}>
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Category</span>
              <select value={newDocumentCategoryId} onChange={(e) => setNewDocumentCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit">Add Document</button>
          </form>
        )}

        {canWrite && (
          <form onSubmit={handleUploadDocument} className="stack top-gap">
            <label className="field">
              <span>Upload new document with file</span>
              <input
                value={newUploadTitle}
                onChange={(e) => setNewUploadTitle(e.target.value)}
                placeholder="Upload title"
              />
            </label>
            <label className="field">
              <span>Department</span>
              <select value={newUploadDepartmentId} onChange={(e) => setNewUploadDepartmentId(e.target.value)}>
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Category</span>
              <select value={newUploadCategoryId} onChange={(e) => setNewUploadCategoryId(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            <button className="btn secondary" type="submit">Upload Document</button>
          </form>
        )}

        <div className="top-gap stack">
          <label className="field">
            <span>Selected document id</span>
            <input
              value={selectedDocumentId}
              onChange={(e) => {
                setSelectedDocumentId(e.target.value)
                setPresignedUrlData(null)
              }}
              placeholder="Document id"
            />
          </label>
          <button className="btn" onClick={handleLoadFullDocument} type="button">
            {loadingFull ? 'Loading Full Document...' : 'Load Full Document'}
          </button>

          {canWrite && (
            <form onSubmit={handleReplaceFile} className="stack">
              <span className="label">Attach/Replace file on selected doc</span>
              <input type="file" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} />
              <button className="btn secondary" type="submit">Attach File To Document</button>
            </form>
          )}

          {selectedDocumentId && (
            <button className="btn ghost" onClick={handleDownloadSelectedDocument} type="button">
              Download file for selected document
            </button>
          )}

          {selectedDocumentId && (
            <button
              className="btn ghost"
              onClick={handleGetPresignedUrl}
              type="button"
              disabled={presignedUrlLoading}
            >
              {presignedUrlLoading ? 'Generating URL...' : 'Get Pre-signed Download URL'}
            </button>
          )}

          {presignedUrlData?.url && (
            <div className="presigned-card">
              <p className="small-note">Pre-signed URL — expires in 60 min. Opens directly in browser.</p>
              <a
                href={presignedUrlData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="presigned-link"
              >
                {presignedUrlData.fileName || 'Download file'}
              </a>
            </div>
          )}
        </div>
      </article>

      {/* ── Right: list + detail ─────────────────────── */}
      <article className="panel">
        <div className="panel-head">
          <h2>Document List</h2>
          <p className="result-meta">
            Showing {filteredDocuments.length} of {documents.length} documents
          </p>
        </div>

        <div className="toolbar-row">
          <label className="field inline compact">
            <span>File Filter</span>
            <select value={docFileFilter} onChange={(e) => setDocFileFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="withFile">With file</option>
              <option value="withoutFile">Without file</option>
            </select>
          </label>
          <label className="field inline compact">
            <span>Sort By</span>
            <select value={docSortBy} onChange={(e) => setDocSortBy(e.target.value)}>
              <option value="id">ID</option>
              <option value="title">Title</option>
              <option value="fileName">File name</option>
            </select>
          </label>
          <label className="field inline compact">
            <span>Order</span>
            <select value={docSortDir} onChange={(e) => setDocSortDir(e.target.value)}>
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <button className="btn ghost" type="button" onClick={clearDocumentFilters}>Reset</button>
        </div>

        {loadingDocs ? <p>Loading documents...</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>File Name</th>
                <th>Translated</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr><td colSpan={4}><p className="empty-state">No documents loaded yet. Add or upload a document first.</p></td></tr>
              ) : filteredDocuments.length === 0 ? (
                <tr><td colSpan={4}>No documents found for current filters.</td></tr>
              ) : (
                filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className={String(doc.id) === selectedDocumentId ? 'row-selected' : ''}
                    onClick={() => {
                      setSelectedDocumentId(String(doc.id))
                      setCommentDocId(String(doc.id))
                      setPresignedUrlData(null)
                    }}
                  >
                    <td>{doc.id}</td>
                    <td>{doc.title || '-'}</td>
                    <td>{doc.fileName || '-'}</td>
                    <td>
                      {doc.translatedText
                        ? <span className="badge translated">✓ FR</span>
                        : <span className="badge pending">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3>Full Document Payload</h3>
        {selectedDocumentDetails?.document?.translatedText && (
          <div className="translated-card">
            <p className="translated-label">🌍 AI Translation (FR)</p>
            <p className="translated-text">{selectedDocumentDetails.document.translatedText}</p>
          </div>
        )}
        <pre>{JSON.stringify(selectedDocumentDetails, null, 2)}</pre>
      </article>
    </section>
  )
}
