export type NavItem = {
  to: string
  label: string
  permission: string
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  { label: 'Work', items: [{ to: '/', label: 'Overview', permission: 'overview' }, { to: '/documents', label: 'Documents', permission: 'documents' }, { to: '/search', label: 'Search', permission: 'documents' }] },
  { label: 'Administration', items: [{ to: '/users', label: 'Users', permission: 'users' }, { to: '/departments', label: 'Departments', permission: 'users' }, { to: '/categories', label: 'Categories', permission: 'settings' }, { to: '/admin/console', label: 'Admin Console', permission: 'logs' }] },
  { label: 'Governance', items: [{ to: '/audit', label: 'Audit', permission: 'audit' }] },
  { label: 'Account', items: [{ to: '/profile', label: 'Profile', permission: 'overview' }] },
]

export function getVisibleNavGroups(groups: NavGroup[], permissions: string[] = [], roles: string[] = []) {
  const isAdmin = roles.includes('ADMIN')
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => permissions.includes(item.permission) || isAdmin),
    }))
    .filter((group) => group.items.length > 0)
}

export function getPageTitle(groups: NavGroup[], pathname: string) {
  const item = groups.flatMap((g) => g.items).find((x) => (x.to === '/' ? pathname === '/' : pathname.startsWith(x.to)))
  return item?.label ?? 'Workspace'
}
