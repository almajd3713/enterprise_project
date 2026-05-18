import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../shared/api/http'
import type { Department } from '../shared/types'
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

export function DepartmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, refetch } = useQuery({ queryKey: ['departments'], queryFn: () => apiGet<Department[]>('/departments') })
  const { pushToast } = useToast()
  const [name, setName] = useState('')
  const [target, setTarget] = useState<Department | null>(null)
  const [editing, setEditing] = useState<Department | null>(null)
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
      await apiPost('/departments', { name })
      setName('')
      setCreateOpen(false)
      await refetch()
      pushToast('success', 'Department created.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Department create failed')
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    try {
      await apiPatch(`/departments/${editing.id}`, { name: editName })
      setEditing(null)
      setEditName('')
      await refetch()
      pushToast('success', 'Department updated.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Department update failed')
    }
  }

  async function remove() {
    if (!target) return
    try {
      await apiDelete(`/departments/${target.id}`)
      setTarget(null)
      await refetch()
      pushToast('success', 'Department deleted.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Department delete failed')
    }
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Departments" subtitle="Manage organizational structure used for access control." actions={<Button type="button" onClick={() => setCreateOpen(true)}>New department</Button>} />
      <Card>
        <CardHeader><CardTitle className="text-lg">Existing departments</CardTitle></CardHeader>
        <CardContent>
          {!data || data.length === 0 ? <EmptyState title="No departments" body="Create your first department to segment access." /> : null}
          {data && data.length > 0 ? (
            <DataGrid
              title="Departments"
              rows={data}
              rowKey={(d) => d.id}
              empty={<EmptyState title="No departments" body="No departments available." />}
              initialSortBy={searchParams.get('dep_sortBy')}
              initialSortDirection={searchParams.get('dep_sortDir') === 'desc' ? 'desc' : 'asc'}
              initialPage={n(searchParams.get('dep_page'), 1)}
              initialPageSize={n(searchParams.get('dep_pageSize'), 10)}
              onStateChange={(state) => updateParams({ dep_sortBy: state.sortBy ?? '', dep_sortDir: state.sortDirection, dep_page: String(state.page), dep_pageSize: String(state.pageSize) })}
              columns={[
                { id: 'id', label: 'ID', sortable: true, sortValue: (d) => d.id, render: (d) => d.id },
                { id: 'name', label: 'Name', sortable: true, sortValue: (d) => d.name, render: (d) => d.name },
                {
                  id: 'action',
                  label: 'Action',
                  render: (d) => (
                    <div className="row-actions">
                      <Button type="button" variant="secondary" onClick={() => { setEditing(d); setEditName(d.name) }} aria-label={`Edit ${d.name}`}>Edit</Button>
                      <Button type="button" variant="destructive" onClick={() => setTarget(d)} aria-label={`Delete ${d.name}`}>Delete</Button>
                    </div>
                  ),
                },
              ]}
            />
          ) : null}
        </CardContent>
      </Card>
      <EntityDrawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create department" description="Add a department to structure access boundaries.">
        <form onSubmit={create} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">Name<Input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <Button type="submit">Create department</Button>
        </form>
      </EntityDrawer>
      <EntityDrawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit department" description="Rename the selected department.">
        <form onSubmit={saveEdit} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">Name<Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></label>
          <Button type="submit">Save changes</Button>
        </form>
      </EntityDrawer>
      <ConfirmDialog open={Boolean(target)} title="Delete department" description={`Delete ${target?.name}? This may affect user access assignment.`} confirmText="Delete" onCancel={() => setTarget(null)} onConfirm={remove} />
    </section>
  )
}
