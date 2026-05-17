import {useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../features/auth/auth-context'
import { apiPost } from '../shared/api/http'
import { PageHeader } from '../shared/ui/PageHeader'
import { useToast } from '../shared/ui/ToastProvider'

export function ProfilePage() {
  const { me } = useAuth()
  const { pushToast } = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

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

  return (
    <section className="stack-lg">
      <PageHeader title="Profile" subtitle="Manage your identity and password securely." />
      <section className="grid two">
        <article className="card">
          <h2>Account details</h2>
          <p><strong>User:</strong> {me?.username}</p>
          <p><strong>Email:</strong> {me?.email || 'Not available'}</p>
          <p><strong>Role:</strong> {me?.role}</p>
        </article>
        <article className="card">
          <h2>Change password</h2>
          <form onSubmit={changePassword}>
            <label>Current password<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></label>
            <label>New password<input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></label>
            <button type="submit">Update password</button>
          </form>
        </article>
      </section>
    </section>
  )
}
