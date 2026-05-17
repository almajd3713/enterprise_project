import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../features/auth/auth-context'
import { apiGet } from '../shared/api/http'
import type { AuditEvent, Category, Department, Document, User } from '../shared/types'
import { formatDate } from '../shared/lib/format'
import { PageHeader } from '../shared/ui/PageHeader'

type Facets = {
  total?: number
  byDepartment?: Record<string, number>
  byCategory?: Record<string, number>
}

function SimpleBarChart({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; value: number }>
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <article className="card">
      <h2>{title}</h2>
      <ul className="bar-chart" aria-label={title}>
        {items.map((item) => (
          <li key={item.label}>
            <div className="bar-chart-head">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <div className="bar-track" role="presentation">
              <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}

export function OverviewPage() {
  const { me } = useAuth()
  const isAdmin = me?.roles.includes('ADMIN')
  const isOperator = me?.roles.includes('OPERATOR')

  const { data: documents = [] } = useQuery({
    queryKey: ['overview-documents'],
    queryFn: () => apiGet<Document[]>('/documents/list'),
  })
  const { data: facets } = useQuery({
    queryKey: ['overview-facets'],
    queryFn: () => apiGet<Facets>('/search/facets'),
  })
  const { data: auditEvents = [] } = useQuery({
    queryKey: ['overview-audit'],
    queryFn: () => apiGet<AuditEvent[]>('/audit/events'),
    enabled: Boolean(me?.permissions.includes('audit') || isAdmin),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['overview-users'],
    queryFn: () => apiGet<User[]>('/users'),
    enabled: Boolean(isAdmin),
  })
  const { data: departments = [] } = useQuery({
    queryKey: ['overview-departments'],
    queryFn: () => apiGet<Department[]>('/departments'),
    enabled: Boolean(isAdmin),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['overview-categories'],
    queryFn: () => apiGet<Category[]>('/documents/categories'),
    enabled: Boolean(isAdmin),
  })

  const docsByDepartment = useMemo(() => {
    const input = facets?.byDepartment ?? {}
    return Object.entries(input)
      .map(([label, value]) => ({ label: `Dept ${label}`, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [facets])

  const adminRoleDist = useMemo(() => {
    const roleMap = new Map<string, number>()
    users.forEach((u) => roleMap.set(u.role, (roleMap.get(u.role) ?? 0) + 1))
    return Array.from(roleMap.entries()).map(([label, value]) => ({ label, value }))
  }, [users])

  const actionDistribution = useMemo(() => {
    const actionMap = new Map<string, number>()
    auditEvents.forEach((e) => actionMap.set(e.action, (actionMap.get(e.action) ?? 0) + 1))
    return Array.from(actionMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [auditEvents])

  const operatorOps = useMemo(() => {
    const watched = new Set(['UPLOAD_DOCUMENT', 'REPLACE_DOCUMENT_FILE', 'REQUEST_TRANSLATION', 'DOWNLOAD_DOCUMENT'])
    const actionMap = new Map<string, number>()
    auditEvents.forEach((e) => {
      if (watched.has(e.action)) actionMap.set(e.action, (actionMap.get(e.action) ?? 0) + 1)
    })
    return Array.from(actionMap.entries()).map(([label, value]) => ({ label, value }))
  }, [auditEvents])

  const recentEvents = useMemo(() => {
    return [...auditEvents]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 6)
  }, [auditEvents])

  const translatedCount = useMemo(
    () => documents.filter((d) => d.translatedText && d.translatedText.trim().length > 0).length,
    [documents],
  )

  return (
    <section className="stack-lg">
      <PageHeader title="Overview" subtitle="Role-aware operational analytics and resource health." />
      <section className="grid two">
        <article className="card">
          <h2>Account</h2>
          <p><strong>User:</strong> {me?.username}</p>
          <p><strong>Role:</strong> {me?.role}</p>
          <p><strong>Email:</strong> {me?.email || 'Not available'}</p>
        </article>
        <article className="card kpi-grid">
          <h2>Snapshot</h2>
          <div className="kpi-items">
            <div><span>Accessible docs</span><strong>{documents.length}</strong></div>
            <div><span>Translated docs</span><strong>{translatedCount}</strong></div>
            <div><span>Recent audits</span><strong>{auditEvents.length}</strong></div>
            {isAdmin ? <div><span>Total users</span><strong>{users.length}</strong></div> : null}
          </div>
        </article>
      </section>

      {isAdmin ? (
        <>
          <section className="grid three">
            <article className="card stat-card"><span>Users</span><strong>{users.length}</strong></article>
            <article className="card stat-card"><span>Departments</span><strong>{departments.length}</strong></article>
            <article className="card stat-card"><span>Categories</span><strong>{categories.length}</strong></article>
          </section>
          <section className="grid two">
            <SimpleBarChart title="User distribution by role" items={adminRoleDist} />
            <SimpleBarChart title="Documents by department" items={docsByDepartment} />
          </section>
          <SimpleBarChart title="Most frequent audited actions" items={actionDistribution} />
        </>
      ) : null}

      {isOperator ? (
        <>
          <section className="grid two">
            <SimpleBarChart title="Operational workload by action" items={operatorOps} />
            <SimpleBarChart title="Document volume by department" items={docsByDepartment} />
          </section>
          <article className="card">
            <h2>Recent operational events</h2>
            <ul className="list">
              {recentEvents.map((e) => (
                <li key={e.id}>
                  <span><strong>{e.action}</strong> by {e.actor}</span>
                  <span className="muted">{formatDate(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </article>
        </>
      ) : null}
    </section>
  )
}
