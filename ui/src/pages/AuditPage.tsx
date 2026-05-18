import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../shared/api/http'
import type { AuditEvent, Department } from '../shared/types'
import { formatDate } from '../shared/lib/format'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function AuditPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: events } = useQuery({ queryKey: ['audit-events'], queryFn: () => apiGet<AuditEvent[]>('/audit/events') })
  const { data: report } = useQuery({ queryKey: ['audit-report'], queryFn: () => apiGet<Record<string, unknown>>('/audit/integrity-report') })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => apiGet<Department[]>('/departments') })
  const [actionFilter, setActionFilter] = useState(searchParams.get('a_q') ?? '')
  const departmentNameById = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments])

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

  function eventTime(e: AuditEvent) {
    return e.occurredAt ?? e.createdAt ?? ''
  }

  function eventEntity(e: AuditEvent) {
    const type = e.resourceType ?? e.entityType ?? 'Unknown'
    const id = e.resourceId ?? e.entityId ?? '-'
    return `${type}:${id}`
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Audit" subtitle="Trace user actions and inspect integrity status." />
      <section className="grid two">
        <Card>
          <CardHeader><CardTitle className="text-lg">Integrity report</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">{Object.entries(report ?? {}).map(([k, v]) => <Badge key={k} variant="secondary">{k}: {String(v)}</Badge>)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Event filters</CardTitle></CardHeader>
          <CardContent>
            <label className="grid gap-1 text-sm font-medium">Filter by actor or action<Input value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); updateParams({ a_q: e.target.value }) }} /></label>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader><CardTitle className="text-lg">Events</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? <EmptyState title="No matching events" body="Adjust your filter to broaden results." /> : null}
          {filtered.length > 0 ? (
            <DataGrid
              title="Audit events"
              rows={filtered}
              rowKey={(e) => String(e.eventId ?? e.id)}
              empty={<EmptyState title="No events" body="No audit events available." />}
              initialSortBy={searchParams.get('a_sortBy')}
              initialSortDirection={searchParams.get('a_sortDir') === 'desc' ? 'desc' : 'asc'}
              initialPage={n(searchParams.get('a_page'), 1)}
              initialPageSize={n(searchParams.get('a_pageSize'), 10)}
              onStateChange={(state) => updateParams({ a_sortBy: state.sortBy ?? '', a_sortDir: state.sortDirection, a_page: String(state.page), a_pageSize: String(state.pageSize) })}
              columns={[
                { id: 'createdAt', label: 'When', sortable: true, sortValue: (e) => eventTime(e), render: (e) => formatDate(eventTime(e)) },
                { id: 'actor', label: 'Actor', sortable: true, sortValue: (e) => e.actor, render: (e) => e.actor },
                { id: 'action', label: 'Action', sortable: true, sortValue: (e) => e.action, render: (e) => e.action },
                { id: 'entity', label: 'Entity', sortable: true, sortValue: (e) => eventEntity(e), render: (e) => eventEntity(e) },
                {
                  id: 'department',
                  label: 'Department',
                  sortable: true,
                  sortValue: (e) => e.departmentId ?? -1,
                  render: (e) => (e.departmentId != null ? (departmentNameById.get(e.departmentId) ?? `Department #${e.departmentId}`) : '-'),
                },
              ]}
            />
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
