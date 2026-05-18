import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../features/auth/auth-context'
import { apiGet } from '../shared/api/http'
import type { AuditEvent, Category, Department, Document, User } from '../shared/types'
import { formatDate } from '../shared/lib/format'
import { PageHeader } from '../shared/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

type Facets = {
  total?: number
  byDepartment?: Record<string, number>
  byCategory?: Record<string, number>
}

const COLORS = ['#1769aa', '#2a88c8', '#5aa7d9', '#8ec2e5', '#a9d3ef', '#d2e8f8', '#f5b47a', '#dd7d38']

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">{children}</div>
      </CardContent>
    </Card>
  )
}

export function OverviewPage() {
  const { me } = useAuth()
  const isAdmin = me?.roles.includes('ADMIN')
  const isOperator = me?.roles.includes('OPERATOR')

  const { data: documents = [] } = useQuery({ queryKey: ['overview-documents'], queryFn: () => apiGet<Document[]>('/documents/list') })
  const { data: facets } = useQuery({ queryKey: ['overview-facets'], queryFn: () => apiGet<Facets>('/search/facets') })
  const { data: auditEvents = [] } = useQuery({ queryKey: ['overview-audit'], queryFn: () => apiGet<AuditEvent[]>('/audit/events'), enabled: Boolean(me?.permissions.includes('audit') || isAdmin) })
  const { data: users = [] } = useQuery({ queryKey: ['overview-users'], queryFn: () => apiGet<User[]>('/users'), enabled: Boolean(isAdmin) })
  const { data: departments = [] } = useQuery({ queryKey: ['overview-departments'], queryFn: () => apiGet<Department[]>('/departments'), enabled: Boolean(isAdmin) })
  const { data: categories = [] } = useQuery({ queryKey: ['overview-categories'], queryFn: () => apiGet<Category[]>('/documents/categories'), enabled: Boolean(isAdmin) })

  const docsByDepartment = useMemo(() => {
    const nameById = new Map(departments.map((d) => [String(d.id), d.name]))
    const fromDocuments = new Map<string, number>()
    documents.forEach((doc) => {
      if (doc.departmentId == null) return
      const key = String(doc.departmentId)
      fromDocuments.set(key, (fromDocuments.get(key) ?? 0) + 1)
    })

    const source = fromDocuments.size > 0
      ? Object.fromEntries(fromDocuments.entries())
      : (facets?.byDepartment ?? {})

    return Object.entries(source)
      .map(([label, value]) => ({ label: nameById.get(label) ?? `Department #${label}`, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [documents, facets, departments])
  const adminRoleDist = useMemo(() => {
    const roleMap = new Map<string, number>()
    users.forEach((u) => roleMap.set(u.role, (roleMap.get(u.role) ?? 0) + 1))
    return Array.from(roleMap.entries()).map(([label, value]) => ({ label, value }))
  }, [users])
  const actionDistribution = useMemo(() => {
    const actionMap = new Map<string, number>()
    auditEvents.forEach((e) => actionMap.set(e.action, (actionMap.get(e.action) ?? 0) + 1))
    return Array.from(actionMap.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [auditEvents])
  const operatorOps = useMemo(() => {
    const watched = new Set(['UPLOAD_DOCUMENT', 'REPLACE_DOCUMENT_FILE', 'REQUEST_TRANSLATION', 'DOWNLOAD_DOCUMENT'])
    const actionMap = new Map<string, number>()
    auditEvents.forEach((e) => {
      if (watched.has(e.action)) actionMap.set(e.action, (actionMap.get(e.action) ?? 0) + 1)
    })
    return Array.from(actionMap.entries()).map(([label, value]) => ({ label, value }))
  }, [auditEvents])
  const recentEvents = useMemo(() => [...auditEvents].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6), [auditEvents])
  const translatedCount = useMemo(() => documents.filter((d) => d.translatedText && d.translatedText.trim().length > 0).length, [documents])

  return (
    <section className="stack-lg">
      <PageHeader title="Overview" subtitle="Role-aware operational analytics and resource health." />
      <section className="grid two">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p><strong>User:</strong> {me?.username}</p>
            <p><strong>Role:</strong> <Badge variant="outline" className="ml-2 align-middle">{me?.role}</Badge></p>
            <p><strong>Email:</strong> {me?.email || 'Not available'}</p>
          </CardContent>
        </Card>
        <Card className="kpi-grid">
          <CardHeader>
            <CardTitle className="text-lg">Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="kpi-items">
              <div><span>Accessible docs</span><strong>{documents.length}</strong></div>
              <div><span>Translated docs</span><strong>{translatedCount}</strong></div>
              <div><span>Recent audits</span><strong>{auditEvents.length}</strong></div>
              {isAdmin ? <div><span>Total users</span><strong>{users.length}</strong></div> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      {isAdmin ? (
        <>
          <section className="grid three">
            <Card className="stat-card"><CardContent className="p-4"><span>Users</span><strong>{users.length}</strong></CardContent></Card>
            <Card className="stat-card"><CardContent className="p-4"><span>Departments</span><strong>{departments.length}</strong></CardContent></Card>
            <Card className="stat-card"><CardContent className="p-4"><span>Categories</span><strong>{categories.length}</strong></CardContent></Card>
          </section>
          <section className="grid two">
            <ChartCard title="User distribution by role">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={adminRoleDist} dataKey="value" nameKey="label" outerRadius={105} innerRadius={45}>
                    {adminRoleDist.map((entry, index) => <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Documents by department">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={docsByDepartment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={0} angle={-20} textAnchor="end" height={55} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Documents" fill="#1769aa" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>
          <ChartCard title="Most frequent audited actions">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionDistribution} layout="vertical" margin={{ left: 30, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={190} />
                <Tooltip />
                <Bar dataKey="value" name="Events" fill="#2a88c8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      ) : null}

      {isOperator ? (
        <>
          <section className="grid two">
            <ChartCard title="Operational workload by action">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operatorOps}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" interval={0} angle={-16} textAnchor="end" height={52} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Ops" fill="#dd7d38" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Document volume by department">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={docsByDepartment} dataKey="value" nameKey="label" outerRadius={100} innerRadius={35}>
                    {docsByDepartment.map((entry, index) => <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent operational events</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list">
                {recentEvents.map((e) => (
                  <li key={String(e.eventId ?? e.id)}>
                    <span><strong>{e.action}</strong> by {e.actor}</span>
                    <span className="muted">{formatDate(e.occurredAt ?? e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  )
}
