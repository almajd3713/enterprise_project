import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useAuth } from '../features/auth/auth-context'
import { LoginPage } from '../pages/LoginPage'
import { RequireAuth, RequirePermission } from '../shared/ui/RequireAuth'
import { OverviewPage } from '../pages/OverviewPage'
import { DocumentsPage } from '../pages/DocumentsPage'
import { DocumentDetailPage } from '../pages/DocumentDetailPage'
import { SearchPage } from '../pages/SearchPage'
import { UsersPage } from '../pages/UsersPage'
import { DepartmentsPage } from '../pages/DepartmentsPage'
import { CategoriesPage } from '../pages/CategoriesPage'
import { AuditPage } from '../pages/AuditPage'
import { ProfilePage } from '../pages/ProfilePage'

const navGroups = [
  {
    label: 'Work',
    items: [
      { to: '/', label: 'Overview', permission: 'overview' },
      { to: '/documents', label: 'Documents', permission: 'documents' },
      { to: '/search', label: 'Search', permission: 'documents' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users', permission: 'users' },
      { to: '/departments', label: 'Departments', permission: 'users' },
      { to: '/categories', label: 'Categories', permission: 'settings' },
    ],
  },
  {
    label: 'Governance',
    items: [{ to: '/audit', label: 'Audit', permission: 'audit' }],
  },
  {
    label: 'Account',
    items: [{ to: '/profile', label: 'Profile', permission: 'overview' }],
  },
]

function Shell() {
  const { logout, me } = useAuth()
  const location = useLocation()
  const [dense, setDense] = useState(() => localStorage.getItem('ui-density') === 'compact')

  const title = useMemo(() => {
    const item = navGroups.flatMap((g) => g.items).find((x) => (x.to === '/' ? location.pathname === '/' : location.pathname.startsWith(x.to)))
    return item?.label ?? 'Workspace'
  }, [location.pathname])

  function toggleDensity() {
    const next = !dense
    setDense(next)
    localStorage.setItem('ui-density', next ? 'compact' : 'balanced')
  }

  return (
    <div className={`layout ${dense ? 'density-compact' : ''}`}>
      <aside className="sidebar" aria-label="Application sidebar">
        <h1>DMS Console</h1>
        <p className="muted">Signed in as <strong>{me?.username}</strong></p>
        <nav aria-label="Main navigation">
          {navGroups.map((group) => (
            <section key={group.label} className="nav-group">
              <h2>{group.label}</h2>
              {group.items
                .filter((item) => me?.permissions.includes(item.permission) || me?.roles.includes('ADMIN'))
                .map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                    {item.label}
                  </NavLink>
                ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-actions">
          <button type="button" className="btn-ghost" onClick={toggleDensity}>{dense ? 'Balanced view' : 'Compact view'}</button>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar" aria-label="Page heading">
          <div>
            <p className="crumbs">Home / {title}</p>
            <h1>{title}</h1>
          </div>
          <span className="role-pill">{me?.role}</span>
        </header>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/documents" element={<RequirePermission permission="documents"><DocumentsPage /></RequirePermission>} />
          <Route path="/documents/:id" element={<RequirePermission permission="documents"><DocumentDetailPage /></RequirePermission>} />
          <Route path="/search" element={<RequirePermission permission="documents"><SearchPage /></RequirePermission>} />
          <Route path="/users" element={<RequirePermission permission="users"><UsersPage /></RequirePermission>} />
          <Route path="/departments" element={<RequirePermission permission="users"><DepartmentsPage /></RequirePermission>} />
          <Route path="/categories" element={<RequirePermission permission="settings"><CategoriesPage /></RequirePermission>} />
          <Route path="/audit" element={<RequirePermission permission="audit"><AuditPage /></RequirePermission>} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </main>
    </div>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<RequireAuth><Shell /></RequireAuth>} />
    </Routes>
  )
}
