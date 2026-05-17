import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '../shared/api/http'
import type { Department } from '../shared/types'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function DepartmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, refetch } = useQuery({ queryKey: ['departments'], queryFn: () => apiGet<Department[]>('/departments') })
  const [name, setName] = useState('')
  const [target, setTarget] = useState<Department | null>(null)

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
    await apiPost('/departments', { name })
    setName('')
    await refetch()
  }

  async function remove() {
    if (!target) return
    await apiDelete(`/departments/${target.id}`)
    setTarget(null)
    await refetch()
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Departments" subtitle="Manage organizational structure used for access control." />
      <section className="card">
        <h2>Create department</h2>
        <form onSubmit={create} className="inline-form">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <button type="submit">Add</button>
        </form>
      </section>
      <section className="card">
        <h2>Existing departments</h2>
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
              { id: 'action', label: 'Action', render: (d) => <button type="button" className="btn-danger" onClick={() => setTarget(d)}>Delete</button> },
            ]}
          />
        ) : null}
      </section>
      <ConfirmDialog open={Boolean(target)} title="Delete department" description={`Delete ${target?.name}? This may affect user access assignment.`} confirmText="Delete" onCancel={() => setTarget(null)} onConfirm={remove} />
    </section>
  )
}
