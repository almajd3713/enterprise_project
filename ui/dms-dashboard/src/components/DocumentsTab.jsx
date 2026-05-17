import { useState } from 'react'

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
  handleTranslateSelectedDocument,
  handleDeleteSelectedDocument,
  role,
  enforceDepartmentScope,
}) {
  const canWrite = String(role).toLowerCase() === 'admin' || String(role).toLowerCase() === 'operator'
  const selectedDoc = documents.find((doc) => String(doc.id) === selectedDocumentId)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <section className="panel-grid two">
      {/* Left: list and selection */}
      <article className="panel">
        <div className="panel-head">
          <h2>Document Library</h2>
          <p className="result-meta">
            Showing {filteredDocuments.length} of {documents.length}
          </p>
        </div>
        {enforceDepartmentScope && (
          <p className="small-note">
            Department scope is active. You only see documents from your assigned department(s).
          </p>
        )}

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
                      setConfirmDelete(false)
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
      </article>

      {/* Right: selected document and operations */}
      <article className="panel">
        <h2>Selected Document Workspace</h2>
        <p className="small-note">
          {selectedDoc
            ? `#${selectedDoc.id} ${selectedDoc.title || '(untitled)'}`
            : 'Select a document from the left table to access full actions.'}
        </p>
        {selectedDoc && (
          <div className="chip-row">
            <span className="chip">Department #{selectedDoc.departmentId ?? '-'}</span>
            <span className="chip">Category #{selectedDoc.categoryId ?? '-'}</span>
            <span className="chip">{selectedDoc.fileName ? `File: ${selectedDoc.fileName}` : 'No file attached'}</span>
          </div>
        )}

        <div className="toolbar-row top-gap">
          <button className="btn" onClick={handleLoadFullDocument} type="button" disabled={!selectedDocumentId}>
            {loadingFull ? 'Loading Full Document...' : 'Load Full Document'}
          </button>
          <button className="btn secondary" onClick={handleTranslateSelectedDocument} type="button" disabled={!selectedDocumentId}>
            Translate Now
          </button>
          <button className="btn ghost" onClick={handleDownloadSelectedDocument} type="button" disabled={!selectedDocumentId}>
            Download File
          </button>
          <button
            className="btn ghost"
            onClick={handleGetPresignedUrl}
            type="button"
            disabled={!selectedDocumentId || presignedUrlLoading}
          >
            {presignedUrlLoading ? 'Generating URL...' : 'Get Pre-signed URL'}
          </button>
          {canWrite && (
            confirmDelete ? (
              <>
                <button className="btn" onClick={handleDeleteSelectedDocument} type="button" disabled={!selectedDocumentId}>
                  Confirm Delete
                </button>
                <button className="btn ghost" onClick={() => setConfirmDelete(false)} type="button">
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="btn"
                onClick={() => setConfirmDelete(true)}
                type="button"
                disabled={!selectedDocumentId}
              >
                Delete Document
              </button>
            )
          )}
        </div>

        {canWrite && (
          <form onSubmit={handleReplaceFile} className="stack top-gap">
            <span className="label">Attach/Replace file on selected document</span>
            <input type="file" onChange={(e) => setReplaceFile(e.target.files?.[0] || null)} />
            <button className="btn secondary" type="submit">Attach File</button>
          </form>
        )}

        {presignedUrlData?.url && (
          <div className="panel top-gap">
            <p className="small-note">Pre-signed URL (valid 60 min)</p>
            <a href={presignedUrlData.url} target="_blank" rel="noopener noreferrer" className="inline-link">
              {presignedUrlData.fileName || 'Open download link'}
            </a>
          </div>
        )}

        <h3>Full Document Payload</h3>
        {selectedDocumentDetails?.document?.translatedText && (
          <div className="translated-card">
            <p className="translated-label">🌍 AI Translation (FR)</p>
            <p className="translated-text">{selectedDocumentDetails.document.translatedText}</p>
          </div>
        )}
        <pre>{JSON.stringify(selectedDocumentDetails, null, 2)}</pre>

        {canWrite && (
          <>
            <h3 className="top-gap">Create Metadata</h3>
            <p className="small-note">New documents are automatically queued for translation after creation.</p>
            <form onSubmit={handleCreateDocument} className="stack">
              <label className="field">
                <span>Title</span>
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
              <button className="btn" type="submit">Create Metadata</button>
            </form>

            <h3 className="top-gap">Upload New Document With File</h3>
            <p className="small-note">Uploaded documents are automatically queued for translation.</p>
            <form onSubmit={handleUploadDocument} className="stack">
              <label className="field">
                <span>Title</span>
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
          </>
        )}
      </article>
    </section>
  )
}
