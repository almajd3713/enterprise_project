import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '../shared/api/http'
import type { Category } from '../shared/types'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function CategoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, refetch } = useQuery({ queryKey: ['categories'], queryFn: () => apiGet<Category[]>('/documents/categories') })
  const [name, setName] = useState('')
  const [target, setTarget] = useState<Category | null>(null)

  function updateParams(extra?: Record<string, string>) {
    const p = new URLSearchParams(searchParams)
    Object.entries(extra ?? {}).forEach(([k, v]) => {
      if (v) p.set(k, v)
      else p.delete(k)
    })
    setSearchParams(p)
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    await apiPost('/documents/categories', { name })
    setName('')
    await refetch()
  }

  async function remove() {
    if (!target) return
    await apiDelete(`/documents/categories/${target.id}`)
    setTarget(null)
    await refetch()
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Categories" subtitle="Define taxonomy used for organizing documents." />
      <section className="card">
        <h2>Create category</h2>
        <form onSubmit={create} className="inline-form">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <button type="submit">Add</button>
        </form>
      </section>
      <section className="card">
        <h2>Existing categories</h2>
        {!data || data.length === 0 ? <EmptyState title="No categories" body="Create a category to support filtering and classification." /> : null}
        {data && data.length > 0 ? (
          <DataGrid
            title="Categories"
            rows={data}
            rowKey={(c) => c.id}
            empty={<EmptyState title="No categories" body="No categories available." />}
            initialSortBy={searchParams.get('cat_sortBy')}
            initialSortDirection={searchParams.get('cat_sortDir') === 'desc' ? 'desc' : 'asc'}
            initialPage={n(searchParams.get('cat_page'), 1)}
            initialPageSize={n(searchParams.get('cat_pageSize'), 10)}
            onStateChange={(state) => updateParams({ cat_sortBy: state.sortBy ?? '', cat_sortDir: state.sortDirection, cat_page: String(state.page), cat_pageSize: String(state.pageSize) })}
            columns={[
              { id: 'id', label: 'ID', sortable: true, sortValue: (c) => c.id, render: (c) => c.id },
              { id: 'name', label: 'Name', sortable: true, sortValue: (c) => c.name, render: (c) => c.name },
              { id: 'action', label: 'Action', render: (c) => <button type="button" className="btn-danger" onClick={() => setTarget(c)}>Delete</button> },
            ]}
          />
        ) : null}
      </section>
      <ConfirmDialog open={Boolean(target)} title="Delete category" description={`Delete ${target?.name}? Existing document metadata may become uncategorized.`} confirmText="Delete" onCancel={() => setTarget(null)} onConfirm={remove} />
    </section>
  )
}
