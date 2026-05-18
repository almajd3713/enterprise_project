import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../features/auth/auth-context'
import { LoginPage } from '../pages/LoginPage'
import { RequireAdmin, RequireAuth, RequirePermission } from '../shared/ui/RequireAuth'
import { OverviewPage } from '../pages/OverviewPage'
import { DocumentsPage } from '../pages/DocumentsPage'
import { DocumentDetailPage } from '../pages/DocumentDetailPage'
import { SearchPage } from '../pages/SearchPage'
import { UsersPage } from '../pages/UsersPage'
import { DepartmentsPage } from '../pages/DepartmentsPage'
import { CategoriesPage } from '../pages/CategoriesPage'
import { AuditPage } from '../pages/AuditPage'
import { ProfilePage } from '../pages/ProfilePage'
import { AdminConsolePage } from '../pages/AdminConsolePage'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { SidebarNav } from '../shared/ui/SidebarNav'
import { getPageTitle, getVisibleNavGroups, navGroups } from './navigation'

function Shell() {
  const { logout, me } = useAuth()
  const location = useLocation()
  const [dense, setDense] = useState(() => localStorage.getItem('ui-density') === 'compact')

  const title = useMemo(() => getPageTitle(navGroups, location.pathname), [location.pathname])
  const visibleGroups = useMemo(
    () => getVisibleNavGroups(navGroups, me?.permissions, me?.roles),
    [me?.permissions, me?.roles],
  )

  function toggleDensity() {
    const next = !dense
    setDense(next)
    localStorage.setItem('ui-density', next ? 'compact' : 'balanced')
  }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', localStorage.getItem('ui-theme') === 'dark')
  }, [])

  return (
    <div className={`layout ${dense ? 'density-compact' : ''}`}>
      <aside className="sidebar" aria-label="Application sidebar">
        <h1 className="text-2xl font-semibold tracking-tight">DMS Console</h1>
        <p className="text-sm text-slate-300">Signed in as <strong>{me?.username}</strong></p>
        <SidebarNav groups={visibleGroups} />
        <div className="sidebar-actions">
          <Button type="button" variant="secondary" onClick={toggleDensity}>{dense ? 'Balanced view' : 'Compact view'}</Button>
          <Button type="button" onClick={logout}>Logout</Button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar" aria-label="Page heading">
          <div>
            <p className="crumbs">Home / {title}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          </div>
          <Badge variant="outline">{me?.role}</Badge>
        </header>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/documents" element={<RequirePermission permission="documents"><DocumentsPage /></RequirePermission>} />
          <Route path="/documents/:id" element={<RequirePermission permission="documents"><DocumentDetailPage /></RequirePermission>} />
          <Route path="/search" element={<RequirePermission permission="documents"><SearchPage /></RequirePermission>} />
          <Route path="/users" element={<RequirePermission permission="users"><UsersPage /></RequirePermission>} />
          <Route path="/departments" element={<RequirePermission permission="users"><DepartmentsPage /></RequirePermission>} />
          <Route path="/categories" element={<RequirePermission permission="settings"><CategoriesPage /></RequirePermission>} />
          <Route path="/admin/console" element={<RequireAdmin><AdminConsolePage /></RequireAdmin>} />
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
