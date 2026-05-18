import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../features/auth/auth-context'
import { apiPost } from '../shared/api/http'
import { PageHeader } from '../shared/ui/PageHeader'
import { useToast } from '../shared/ui/ToastProvider'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

export function ProfilePage() {
  const { me } = useAuth()
  const { pushToast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ui-theme') === 'dark')

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    try {
      await apiPost('/users/change-password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      pushToast('success', 'Password changed.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Password change failed')
    }
  }

  function toggleDarkMode(checked: boolean) {
    setDarkMode(checked)
    localStorage.setItem('ui-theme', checked ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', checked)
  }

  return (
    <section className="stack-lg">
      <PageHeader title="Profile" subtitle="Manage your identity and password securely." />
      <section className="grid two">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Account details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p><strong>User:</strong> {me?.username}</p>
            <p><strong>Email:</strong> {me?.email || 'Not available'}</p>
            <p><strong>Role:</strong> <Badge variant="outline" className="ml-2 align-middle">{me?.role}</Badge></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Appearance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="inline-form" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="text-sm font-medium">Dark mode</span>
              <input
                type="checkbox"
                role="switch"
                checked={darkMode}
                onChange={(e) => toggleDarkMode(e.target.checked)}
              />
            </label>
          </CardContent>
        </Card>
      </section>
      <section className="grid two">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="grid gap-3">
              <label className="grid gap-1 text-sm font-medium">
                Current password
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                New password
                <Input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </label>
              <Button type="submit">Update password</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Security tips</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>Use a unique password with at least 8 characters.</p>
            <p>Avoid reusing credentials from other platforms.</p>
          </CardContent>
        </Card>
      </section>
    </section>
  )
}
