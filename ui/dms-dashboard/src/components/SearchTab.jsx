export default function SearchTab({
  searchQuery,
  setSearchQuery,
  searchOwner,
  setSearchOwner,
  searchDepartment,
  setSearchDepartment,
  searchCategory,
  setSearchCategory,
  departments,
  categories,
  searchResults,
  searchFacets,
  searchLoading,
  runSearch,
  loadSearchFacets,
}) {
  return (
    <section className="panel-grid one">
      <article className="panel">
        <div className="panel-head">
          <h2>Search</h2>
          <div className="toolbar-row">
            <button className="btn secondary" type="button" onClick={runSearch} disabled={searchLoading}>
              {searchLoading ? 'Searching...' : 'Run Search'}
            </button>
            <button className="btn ghost" type="button" onClick={loadSearchFacets}>
              Refresh Facets
            </button>
          </div>
        </div>

        <div className="toolbar-row top-gap">
          <label className="field inline compact grow">
            <span>Query</span>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="title, text, filename" />
          </label>
          <label className="field inline compact">
            <span>Owner</span>
            <input value={searchOwner} onChange={(e) => setSearchOwner(e.target.value)} placeholder="username" />
          </label>
          <label className="field inline compact">
            <span>Department</span>
            <select value={searchDepartment} onChange={(e) => setSearchDepartment(e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="field inline compact">
            <span>Category</span>
            <select value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}>
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="kpi-list top-gap">
          <p>Total Indexed: <strong>{searchFacets?.total ?? '-'}</strong></p>
        </div>

        <div className="table-wrap top-gap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Owner</th>
                <th>Department</th>
                <th>Category</th>
                <th>File</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.length === 0 ? (
                <tr><td colSpan={6}>No matching documents.</td></tr>
              ) : (
                searchResults.map((row) => (
                  <tr key={row.documentId}>
                    <td>{row.documentId}</td>
                    <td>{row.title || '-'}</td>
                    <td>{row.ownerId || '-'}</td>
                    <td>{row.departmentId ?? '-'}</td>
                    <td>{row.categoryId ?? '-'}</td>
                    <td>{row.fileName || '-'}</td>
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
