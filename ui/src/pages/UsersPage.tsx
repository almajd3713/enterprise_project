import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost } from '../shared/api/http'
import type { User } from '../shared/types'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'
import { useToast } from '../shared/ui/ToastProvider'

const n = (v: string | null, d: number) => {
  const p = Number(v)
  return Number.isFinite(p) && p > 0 ? p : d
}

export function UsersPage() {
  const { pushToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, refetch, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => apiGet<User[]>('/users') })
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('USER')
  const [query, setQuery] = useState(searchParams.get('u_q') ?? '')
  const [target, setTarget] = useState<User | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return (data ?? []).filter((u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [data, query])

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
    await apiPost('/users', { username, email, password, role })
    setUsername('')
    setEmail('')
    setPassword('')
    await refetch()
    pushToast('success', 'User created.')
  }

  async function toggleActive() {
    if (!target) return
    await apiPatch(`/users/${target.id}/state`, { active: !target.active })
    setTarget(null)
    await refetch()
    pushToast('success', 'User status updated.')
  }

  async function updateRole(userId: number, nextRole: string) {
    await apiPatch(`/users/${userId}/role`, { role: nextRole })
    await refetch()
    pushToast('success', 'User role updated.')
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Users" subtitle="Create users and manage account state." />
      <section className="grid two">
        <article className="card">
          <h2>Directory</h2>
          <label>Filter users<input value={query} onChange={(e) => { setQuery(e.target.value); updateParams({ u_q: e.target.value }) }} placeholder="username or email" /></label>
          {isLoading ? <p>Loading users...</p> : null}
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
                { id: 'status', label: 'Status', sortable: true, sortValue: (u) => (u.active ? 1 : 0), render: (u) => <span className={`status-pill ${u.active ? 'ok' : 'warn'}`}>{u.active ? 'Active' : 'Disabled'}</span> },
                { id: 'action', label: 'Action', render: (u) => <button type="button" className="btn-ghost" onClick={() => setTarget(u)}>{u.active ? 'Disable' : 'Enable'} user</button> },
              ]}
            />
          ) : null}
        </article>
        <article className="card">
          <h2>Create user</h2>
          <form onSubmit={createUser}>
            <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <label>Role<select value={role} onChange={(e) => setRole(e.target.value)}><option>ADMIN</option><option>OPERATOR</option><option>ANALYST</option><option>USER</option></select></label>
            <button type="submit">Create user</button>
          </form>
        </article>
      </section>
      <ConfirmDialog open={Boolean(target)} title={`${target?.active ? 'Disable' : 'Enable'} user`} description={`Are you sure you want to ${target?.active ? 'disable' : 'enable'} ${target?.username}?`} confirmText={target?.active ? 'Disable user' : 'Enable user'} onCancel={() => setTarget(null)} onConfirm={toggleActive} />
    </section>
  )
}
