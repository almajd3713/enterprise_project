import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../shared/api/http'
import type { AuditEvent } from '../shared/types'
import { formatDate } from '../shared/lib/format'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function AuditPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: events } = useQuery({ queryKey: ['audit-events'], queryFn: () => apiGet<AuditEvent[]>('/audit/events') })
  const { data: report } = useQuery({ queryKey: ['audit-report'], queryFn: () => apiGet<Record<string, unknown>>('/audit/integrity-report') })
  const [actionFilter, setActionFilter] = useState(searchParams.get('a_q') ?? '')

  const filtered = useMemo(() => {
    const q = actionFilter.toLowerCase().trim()
    return (events ?? []).filter((e) => e.action.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q))
  }, [events, actionFilter])

  function updateParams(extra?: Record<string, string>) {
    const p = new URLSearchParams(searchParams)
    const pairs = { a_q: actionFilter, ...extra }
    Object.entries(pairs).forEach(([k, v]) => {
      if (v) p.set(k, v)
      else p.delete(k)
    })
    setSearchParams(p)
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Audit" subtitle="Trace user actions and inspect integrity status." />
      <section className="grid two">
        <article className="card"><h2>Integrity report</h2><div className="chips">{Object.entries(report ?? {}).map(([k, v]) => <span key={k} className="chip">{k}: {String(v)}</span>)}</div></article>
        <article className="card"><h2>Event filters</h2><label>Filter by actor or action<input value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); updateParams({ a_q: e.target.value }) }} /></label></article>
      </section>
      <article className="card">
        <h2>Events</h2>
        {filtered.length === 0 ? <EmptyState title="No matching events" body="Adjust your filter to broaden results." /> : null}
        {filtered.length > 0 ? (
          <DataGrid
            title="Audit events"
            rows={filtered}
            rowKey={(e) => e.id}
            empty={<EmptyState title="No events" body="No audit events available." />}
            initialSortBy={searchParams.get('a_sortBy')}
            initialSortDirection={searchParams.get('a_sortDir') === 'desc' ? 'desc' : 'asc'}
            initialPage={n(searchParams.get('a_page'), 1)}
            initialPageSize={n(searchParams.get('a_pageSize'), 10)}
            onStateChange={(state) => updateParams({ a_sortBy: state.sortBy ?? '', a_sortDir: state.sortDirection, a_page: String(state.page), a_pageSize: String(state.pageSize) })}
            columns={[
              { id: 'createdAt', label: 'When', sortable: true, sortValue: (e) => e.createdAt, render: (e) => formatDate(e.createdAt) },
              { id: 'actor', label: 'Actor', sortable: true, sortValue: (e) => e.actor, render: (e) => e.actor },
              { id: 'action', label: 'Action', sortable: true, sortValue: (e) => e.action, render: (e) => e.action },
              { id: 'entity', label: 'Entity', sortable: true, sortValue: (e) => `${e.entityType}:${e.entityId}`, render: (e) => `${e.entityType}:${e.entityId}` },
              { id: 'department', label: 'Department', sortable: true, sortValue: (e) => e.departmentId ?? -1, render: (e) => e.departmentId ?? '-' },
            ]}
          />
        ) : null}
      </article>
    </section>
  )
}
