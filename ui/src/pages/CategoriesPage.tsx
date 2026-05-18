import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../shared/api/http'
import type { Category } from '../shared/types'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'
import { EntityDrawer } from '../shared/ui/EntityDrawer'
import { useToast } from '../shared/ui/ToastProvider'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function CategoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, refetch } = useQuery({ queryKey: ['categories'], queryFn: () => apiGet<Category[]>('/documents/categories') })
  const { pushToast } = useToast()
  const [name, setName] = useState('')
  const [target, setTarget] = useState<Category | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

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
    try {
      await apiPost('/documents/categories', { name })
      setName('')
      setCreateOpen(false)
      await refetch()
      pushToast('success', 'Category created.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Category create failed')
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    try {
      await apiPatch(`/documents/categories/${editing.id}`, { name: editName })
      setEditing(null)
      setEditName('')
      await refetch()
      pushToast('success', 'Category updated.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Category update failed')
    }
  }

  async function remove() {
    if (!target) return
    try {
      await apiDelete(`/documents/categories/${target.id}`)
      setTarget(null)
      await refetch()
      pushToast('success', 'Category deleted.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Category delete failed')
    }
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Categories" subtitle="Define taxonomy used for organizing documents." actions={<Button type="button" onClick={() => setCreateOpen(true)}>New category</Button>} />
      <Card>
        <CardHeader><CardTitle className="text-lg">Existing categories</CardTitle></CardHeader>
        <CardContent>
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
                {
                  id: 'action',
                  label: 'Action',
                  render: (c) => (
                    <div className="row-actions">
                      <Button type="button" variant="secondary" onClick={() => { setEditing(c); setEditName(c.name) }} aria-label={`Edit ${c.name}`}>Edit</Button>
                      <Button type="button" variant="destructive" onClick={() => setTarget(c)} aria-label={`Delete ${c.name}`}>Delete</Button>
                    </div>
                  ),
                },
              ]}
            />
          ) : null}
        </CardContent>
      </Card>
      <EntityDrawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create category" description="Add a category used in document classification.">
        <form onSubmit={create} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">Name<Input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <Button type="submit">Create category</Button>
        </form>
      </EntityDrawer>
      <EntityDrawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit category" description="Rename the selected category.">
        <form onSubmit={saveEdit} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">Name<Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></label>
          <Button type="submit">Save changes</Button>
        </form>
      </EntityDrawer>
      <ConfirmDialog open={Boolean(target)} title="Delete category" description={`Delete ${target?.name}? Existing document metadata may become uncategorized.`} confirmText="Delete" onCancel={() => setTarget(null)} onConfirm={remove} />
    </section>
  )
}
