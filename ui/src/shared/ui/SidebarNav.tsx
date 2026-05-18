import { NavLink } from 'react-router-dom'
import type { NavGroup } from '../../app/navigation'

type SidebarNavProps = {
  groups: NavGroup[]
}

export function SidebarNav({ groups }: SidebarNavProps) {
  return (
    <nav aria-label="Main navigation" className="grid gap-3">
      {groups.map((group) => (
        <section key={group.label} className="nav-group">
          <h2>{group.label}</h2>
          {group.items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </section>
      ))}
    </nav>
  )
}
