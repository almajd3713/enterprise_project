import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost } from '../shared/api/http'
import type { Department, User } from '../shared/types'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'
import { EntityDrawer } from '../shared/ui/EntityDrawer'
import { useToast } from '../shared/ui/ToastProvider'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function UsersPage() {
  const { pushToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, refetch, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => apiGet<User[]>('/users') })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => apiGet<Department[]>('/departments') })

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('USER')
  const [query, setQuery] = useState(searchParams.get('u_q') ?? '')
  const [target, setTarget] = useState<User | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingDepartmentsFor, setEditingDepartmentsFor] = useState<User | null>(null)
  const [selectedDepartments, setSelectedDepartments] = useState<number[]>([])
  const [resetPasswordFor, setResetPasswordFor] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return (data ?? []).filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [data, query])
  const departmentNameById = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments])

  function updateParams(extra?: Record<string, string>) {
    const p = new URLSearchParams(searchParams)
    const pairs = { u_q: query, ...extra }
    Object.entries(pairs).forEach(([k, v]) => {
      if (v) p.set(k, v)
      else p.delete(k)
    })
    setSearchParams(p)
  }

  async function createUser(e: FormEvent) {
    e.preventDefault()
    try {
      await apiPost('/users', { username, email, password, role })
      setUsername('')
      setEmail('')
      setPassword('')
      setRole('USER')
      setCreateOpen(false)
      await refetch()
      pushToast('success', 'User created.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'User create failed')
    }
  }

  async function toggleActive() {
    if (!target) return
    try {
      await apiPatch(`/users/${target.id}/state`, { active: !target.active })
      setTarget(null)
      await refetch()
      pushToast('success', 'User status updated.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'User status update failed')
    }
  }

  async function updateRole(userId: number, nextRole: string) {
    await apiPatch(`/users/${userId}/role`, { role: nextRole })
    await refetch()
    pushToast('success', 'User role updated.')
  }

  async function saveDepartments(e: FormEvent) {
    e.preventDefault()
    if (!editingDepartmentsFor) return
    try {
      await apiPatch(`/users/${editingDepartmentsFor.id}/departments`, { departmentIds: selectedDepartments })
      setEditingDepartmentsFor(null)
      setSelectedDepartments([])
      await refetch()
      pushToast('success', 'Departments updated.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Department assignment update failed')
    }
  }

  async function submitPasswordReset(e: FormEvent) {
    e.preventDefault()
    if (!resetPasswordFor) return
    try {
      await apiPost(`/users/${resetPasswordFor.id}/reset-password`, { newPassword })
      setResetPasswordFor(null)
      setNewPassword('')
      pushToast('success', 'Password reset.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Password reset failed')
    }
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Users" subtitle="Create users and manage account state." actions={<Button type="button" onClick={() => setCreateOpen(true)}>New user</Button>} />
      <section className="grid">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="grid gap-1 text-sm font-medium">
              Filter users
              <Input value={query} onChange={(e) => { setQuery(e.target.value); updateParams({ u_q: e.target.value }) }} placeholder="username or email" />
            </label>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
            {!isLoading && filtered.length === 0 ? <EmptyState title="No users found" body="Try a different search or create a new user." /> : null}
            {filtered.length > 0 ? (
              <DataGrid
                title="Users"
                rows={filtered}
                rowKey={(u) => u.id}
                empty={<EmptyState title="No users" body="No users available." />}
                initialSortBy={searchParams.get('u_sortBy')}
                initialSortDirection={searchParams.get('u_sortDir') === 'desc' ? 'desc' : 'asc'}
                initialPage={n(searchParams.get('u_page'), 1)}
                initialPageSize={n(searchParams.get('u_pageSize'), 10)}
                onStateChange={(state) => updateParams({ u_sortBy: state.sortBy ?? '', u_sortDir: state.sortDirection, u_page: String(state.page), u_pageSize: String(state.pageSize) })}
                columns={[
                  { id: 'username', label: 'Username', sortable: true, sortValue: (u) => u.username, render: (u) => u.username },
                  {
                    id: 'role',
                    label: 'Role',
                    sortable: true,
                    sortValue: (u) => u.role,
                    render: (u) => (
                      <select
                        value={u.role}
                        aria-label={`Role for ${u.username}`}
                        onChange={(e) => {
                          const value = e.target.value
                          updateRole(u.id, value).catch((err) => {
                            pushToast('error', err instanceof Error ? err.message : 'Role update failed')
                          })
                        }}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="OPERATOR">OPERATOR</option>
                        <option value="ANALYST">ANALYST</option>
                        <option value="USER">USER</option>
                      </select>
                    ),
                  },
                  {
                    id: 'departments',
                    label: 'Departments',
                    render: (u) => (
                      u.departmentIds && u.departmentIds.length > 0
                        ? u.departmentIds.map((id) => departmentNameById.get(id) ?? `Department #${id}`).join(', ')
                        : '-'
                    ),
                  },
                  {
                    id: 'status',
                    label: 'Status',
                    sortable: true,
                    sortValue: (u) => (u.active ? 1 : 0),
                    render: (u) => <Badge variant="outline">{u.active ? 'Active' : 'Disabled'}</Badge>,
                  },
                  {
                    id: 'action',
                    label: 'Actions',
                    render: (u) => (
                      <div className="row-actions">
                        <Button type="button" variant="secondary" onClick={() => { setEditingDepartmentsFor(u); setSelectedDepartments(u.departmentIds ?? []) }}>Departments</Button>
                        <Button type="button" variant="secondary" onClick={() => setResetPasswordFor(u)}>Reset password</Button>
                        <Button type="button" variant="secondary" onClick={() => setTarget(u)}>
                          {u.active ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            ) : null}
          </CardContent>
        </Card>
      </section>

      <EntityDrawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create user" description="Provision a new user account and assign a role.">
        <form onSubmit={createUser} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">Username<Input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium">Email<Input value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium">Password<Input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium">Role<select value={role} onChange={(e) => setRole(e.target.value)}><option>ADMIN</option><option>OPERATOR</option><option>ANALYST</option><option>USER</option></select></label>
          <Button type="submit">Create user</Button>
        </form>
      </EntityDrawer>

      <EntityDrawer open={Boolean(editingDepartmentsFor)} onClose={() => setEditingDepartmentsFor(null)} title="Edit user departments" description={`Assign departments for ${editingDepartmentsFor?.username ?? 'user'}.`}>
        <form onSubmit={saveDepartments} className="grid gap-3">
          <div className="grid gap-2">
            {departments.map((department) => {
              const checked = selectedDepartments.includes(department.id)
              return (
                <label key={department.id} className="inline-form" style={{ alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setSelectedDepartments((prev) => {
                        if (e.target.checked) return [...prev, department.id]
                        return prev.filter((id) => id !== department.id)
                      })
                    }}
                  />
                  <span>{department.name}</span>
                </label>
              )
            })}
          </div>
          <Button type="submit">Save assignments</Button>
        </form>
      </EntityDrawer>

      <EntityDrawer open={Boolean(resetPasswordFor)} onClose={() => setResetPasswordFor(null)} title="Reset password" description={`Set a new password for ${resetPasswordFor?.username ?? 'user'}.`}>
        <form onSubmit={submitPasswordReset} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">New password<Input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
          <Button type="submit">Reset password</Button>
        </form>
      </EntityDrawer>

      <ConfirmDialog open={Boolean(target)} title={`${target?.active ? 'Disable' : 'Enable'} user`} description={`Are you sure you want to ${target?.active ? 'disable' : 'enable'} ${target?.username}?`} confirmText={target?.active ? 'Disable user' : 'Enable user'} onCancel={() => setTarget(null)} onConfirm={toggleActive} />
    </section>
  )
}
