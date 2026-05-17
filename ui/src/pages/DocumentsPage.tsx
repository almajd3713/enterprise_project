import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet, apiPost, apiUpload } from '../shared/api/http'
import type { Category, Department, Document } from '../shared/types'
import { prettyBytes } from '../shared/lib/format'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'
import { useToast } from '../shared/ui/ToastProvider'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function DocumentsPage() {
  const { pushToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, refetch, error, isLoading } = useQuery({ queryKey: ['documents'], queryFn: () => apiGet<Document[]>('/documents/list') })
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => apiGet<Department[]>('/departments') })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => apiGet<Category[]>('/documents/categories') })

  const [title, setTitle] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [q, setQ] = useState(searchParams.get('d_q') ?? '')
  const [uploadOpen, setUploadOpen] = useState(false)

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim()
    return (data ?? []).filter((d) => d.title.toLowerCase().includes(query) || d.ownerId.toLowerCase().includes(query))
  }, [data, q])

  function updateParams(extra?: Record<string, string>) {
    const p = new URLSearchParams(searchParams)
    const pairs = { d_q: q, ...extra }
    Object.entries(pairs).forEach(([k, v]) => {
      if (v) p.set(k, v)
      else p.delete(k)
    })
    setSearchParams(p)
  }

  async function createDoc(e: FormEvent) {
    e.preventDefault()
    try {
      await apiPost('/documents/add', { title, departmentId: departmentId ? Number(departmentId) : null, categoryId: categoryId ? Number(categoryId) : null })
      setTitle('')
      setDepartmentId('')
      setCategoryId('')
      await refetch()
      pushToast('success', 'Document metadata created.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Create failed')
    }
  }

  async function uploadDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      const form = new FormData(e.currentTarget)
      await apiUpload('/documents/upload', form)
      e.currentTarget.reset()
      setUploadOpen(false)
      await refetch()
      pushToast('success', 'Document uploaded.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Document Library" subtitle="Search, create metadata, and upload files in one workspace." actions={<button type="button" onClick={() => setUploadOpen((v) => !v)}>{uploadOpen ? 'Close upload' : 'Upload document'}</button>} />
      {uploadOpen ? (
        <article className="card">
          <h2>Upload document</h2>
          <form onSubmit={uploadDoc} className="grid two">
            <label>Title<input name="title" required /></label>
            <label>File<input name="file" type="file" required /></label>
            <label>Department<select name="departmentId" defaultValue=""><option value="">No department</option>{departments?.map((d) => <option key={d.id} value={d.id}>{d.name} (#{d.id})</option>)}</select></label>
            <label>Category<select name="categoryId" defaultValue=""><option value="">No category</option>{categories?.map((c) => <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>)}</select></label>
            <button type="submit">Upload</button>
          </form>
        </article>
      ) : null}
      <section className="grid two">
        <article className="card">
          <h2>Documents</h2>
          <label>Quick filter<input placeholder="Filter by title or owner" value={q} onChange={(e) => { setQ(e.target.value); updateParams({ d_q: e.target.value }) }} /></label>
          {error ? <p className="error">{(error as Error).message}</p> : null}
          {isLoading ? <p>Loading documents...</p> : null}
          {!isLoading && filtered.length === 0 ? <EmptyState title="No documents found" body="Try a different query or upload a new document." /> : null}
          {filtered.length > 0 ? (
            <DataGrid
              title="Documents"
              rows={filtered}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No documents" body="No documents available." />}
              initialSortBy={searchParams.get('d_sortBy')}
              initialSortDirection={searchParams.get('d_sortDir') === 'desc' ? 'desc' : 'asc'}
              initialPage={n(searchParams.get('d_page'), 1)}
              initialPageSize={n(searchParams.get('d_pageSize'), 10)}
              onStateChange={(state) => updateParams({ d_sortBy: state.sortBy ?? '', d_sortDir: state.sortDirection, d_page: String(state.page), d_pageSize: String(state.pageSize) })}
              columns={[
                { id: 'title', label: 'Title', sortable: true, sortValue: (r) => r.title, render: (r) => r.title },
                { id: 'ownerId', label: 'Owner', sortable: true, sortValue: (r) => r.ownerId, render: (r) => r.ownerId },
                { id: 'departmentId', label: 'Department', sortable: true, sortValue: (r) => r.departmentId ?? -1, render: (r) => r.departmentId ?? '-' },
                { id: 'size', label: 'Size', sortable: true, sortValue: (r) => r.fileSize ?? 0, render: (r) => prettyBytes(r.fileSize) },
                { id: 'actions', label: 'Actions', render: (r) => <Link className="action-link" to={`/documents/${r.id}`}>Open document</Link> },
              ]}
            />
          ) : null}
        </article>
        <article className="card">
          <h2>Create metadata</h2>
          <form onSubmit={createDoc}>
            <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label>Department<select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">No department</option>{departments?.map((d) => <option key={d.id} value={d.id}>{d.name} (#{d.id})</option>)}</select></label>
            <label>Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">No category</option>{categories?.map((c) => <option key={c.id} value={c.id}>{c.name} (#{c.id})</option>)}</select></label>
            <button type="submit">Create metadata</button>
          </form>
        </article>
      </section>
    </section>
  )
}
