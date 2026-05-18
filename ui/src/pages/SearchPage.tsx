import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../shared/api/http'
import type { Category, Department, SearchResult } from '../shared/types'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'

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
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => apiGet<Department[]>('/departments') })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => apiGet<Category[]>('/documents/categories') })
  const departmentNameById = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments])
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const chips = useMemo(() => [
    query && `Query: ${query}`,
    departmentId && `Department: ${departmentNameById.get(Number(departmentId)) ?? `#${departmentId}`}`,
    categoryId && `Category: ${categoryNameById.get(Number(categoryId)) ?? `#${categoryId}`}`,
    ownerId && `Owner: ${ownerId}`,
  ].filter(Boolean), [query, departmentId, categoryId, ownerId, departmentNameById, categoryNameById])

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
      <PageHeader title="Search" subtitle="Find documents with query and structured filters." actions={<Button type="button" variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
      <section className="grid two">
        <Card>
          <CardHeader><CardTitle className="text-lg">Filters</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3">
              <label className="grid gap-1 text-sm font-medium">Query<Input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
              <label className="grid gap-1 text-sm font-medium">Department<select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">Any department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-medium">Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Any category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="grid gap-1 text-sm font-medium">Owner ID<Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} /></label>
              <Button type="submit">Run search</Button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">{chips.map((chip) => <Badge key={chip} variant="secondary">{chip}</Badge>)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Facet snapshot</CardTitle></CardHeader>
          <CardContent><pre className="code-block">{JSON.stringify(facets, null, 2)}</pre></CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader><CardTitle className="text-lg">Results</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Searching...</p> : null}
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
              onStateChange={(state) => updateParams({ s_sortBy: state.sortBy ?? '', s_sortDir: state.sortDirection, s_page: String(state.page), s_pageSize: String(state.pageSize) })}
              columns={[
                { id: 'title', label: 'Title', sortable: true, sortValue: (r) => r.title, render: (r) => r.title || '-' },
                { id: 'owner', label: 'Owner', sortable: true, sortValue: (r) => r.ownerId, render: (r) => r.ownerId || '-' },
                { id: 'department', label: 'Department', sortable: true, sortValue: (r) => r.departmentId ?? -1, render: (r) => (r.departmentId != null ? (departmentNameById.get(r.departmentId) ?? `Department #${r.departmentId}`) : '-') },
                { id: 'category', label: 'Category', sortable: true, sortValue: (r) => r.categoryId ?? -1, render: (r) => (r.categoryId != null ? (categoryNameById.get(r.categoryId) ?? `Category #${r.categoryId}`) : '-') },
                { id: 'actions', label: 'Actions', render: (r) => <Link className="action-link" to={`/documents/${r.documentId}`}>Open document #{r.documentId}</Link> },
              ]}
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
