import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../shared/api/http'
import type { SearchResult } from '../shared/types'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [departmentId, setDepartmentId] = useState(searchParams.get('departmentId') ?? '')
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '')
  const [ownerId, setOwnerId] = useState(searchParams.get('ownerId') ?? '')

  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (query) p.set('q', query)
    if (departmentId) p.set('departmentId', departmentId)
    if (categoryId) p.set('categoryId', categoryId)
    if (ownerId) p.set('ownerId', ownerId)
    return p.toString() ? `?${p.toString()}` : ''
  }, [query, departmentId, categoryId, ownerId])

  const { data, isLoading } = useQuery({ queryKey: ['search', params], queryFn: () => apiGet<SearchResult[]>(`/search/documents${params}`) })
  const { data: facets } = useQuery({ queryKey: ['facets'], queryFn: () => apiGet<Record<string, unknown>>('/search/facets') })

  const chips = useMemo(() => [query && `Query: ${query}`, departmentId && `Department: ${departmentId}`, categoryId && `Category: ${categoryId}`, ownerId && `Owner: ${ownerId}`].filter(Boolean), [query, departmentId, categoryId, ownerId])

  function updateParams(extra?: Record<string, string>) {
    const p = new URLSearchParams(searchParams)
    const pairs = { q: query, departmentId, categoryId, ownerId, ...extra }
    Object.entries(pairs).forEach(([k, v]) => {
      if (v) p.set(k, v)
      else p.delete(k)
    })
    setSearchParams(p)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    updateParams()
  }

  function clearFilters() {
    setQuery('')
    setDepartmentId('')
    setCategoryId('')
    setOwnerId('')
    setSearchParams(new URLSearchParams())
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Search" subtitle="Find documents with query and structured filters." actions={<button type="button" className="btn-ghost" onClick={clearFilters}>Clear filters</button>} />
      <section className="grid two">
        <article className="card">
          <h2>Filters</h2>
          <form onSubmit={submit}>
            <label>Query<input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <label>Department ID<input value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} /></label>
            <label>Category ID<input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} /></label>
            <label>Owner ID<input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} /></label>
            <button type="submit">Run search</button>
          </form>
          <div className="chips">{chips.map((chip) => <span key={chip} className="chip">{chip}</span>)}</div>
        </article>
        <article className="card">
          <h2>Facet snapshot</h2>
          <pre className="code-block">{JSON.stringify(facets, null, 2)}</pre>
        </article>
      </section>
      <article className="card">
        <h2>Results</h2>
        {isLoading ? <p>Searching...</p> : null}
        {!isLoading && (!data || data.length === 0) ? <EmptyState title="No results" body="Try broader terms or remove filters." /> : null}
        {data && data.length > 0 ? (
          <DataGrid
            title="Search results"
            rows={data.filter((r) => Number.isFinite(r.documentId))}
            rowKey={(row) => row.documentId}
            empty={<EmptyState title="No valid results" body="Search returned malformed rows with no document id." />}
            initialSortBy={searchParams.get('s_sortBy')}
            initialSortDirection={searchParams.get('s_sortDir') === 'desc' ? 'desc' : 'asc'}
            initialPage={n(searchParams.get('s_page'), 1)}
            initialPageSize={n(searchParams.get('s_pageSize'), 10)}
            onStateChange={(state) => updateParams({
              s_sortBy: state.sortBy ?? '',
              s_sortDir: state.sortDirection,
              s_page: String(state.page),
              s_pageSize: String(state.pageSize),
            })}
            columns={[
              { id: 'title', label: 'Title', sortable: true, sortValue: (r) => r.title, render: (r) => r.title || '-' },
              { id: 'owner', label: 'Owner', sortable: true, sortValue: (r) => r.ownerId, render: (r) => r.ownerId || '-' },
              { id: 'department', label: 'Department', sortable: true, sortValue: (r) => r.departmentId ?? -1, render: (r) => r.departmentId ?? '-' },
              { id: 'category', label: 'Category', sortable: true, sortValue: (r) => r.categoryId ?? -1, render: (r) => r.categoryId ?? '-' },
              { id: 'actions', label: 'Actions', render: (r) => <Link className="action-link" to={`/documents/${r.documentId}`}>Open document #{r.documentId}</Link> },
            ]}
          />
        ) : null}
      </article>
    </section>
  )
}
