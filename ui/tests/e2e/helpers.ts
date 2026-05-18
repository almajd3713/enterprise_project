import { expect, type Page } from '@playwright/test'

type LoginResponse = { token: string }
export type Department = { id: number; name: string }
export type User = { id: number; username: string; departmentIds: number[] }
export type Category = { id: number; name: string }
export type Document = { id: number; title: string; translatedText?: string | null; translatedDescription?: string | null }

const GATEWAY_BASE = process.env.PLAYWRIGHT_GATEWAY_BASE ?? 'http://localhost:8080'
export const API_BASE = process.env.API_BASE ?? `${GATEWAY_BASE}/api`

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

export async function loginApi(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  expect(res.ok).toBeTruthy()
  const json = (await res.json()) as LoginResponse
  return json.token
}

export async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(init?.headers ?? {}),
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${path} failed (${res.status}): ${body}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function ensureDepartment(name: string, adminToken: string): Promise<number> {
  const existing = await api<Department[]>('/departments', adminToken)
  const found = existing.find((d) => d.name.toLowerCase() === name.toLowerCase())
  if (found) return found.id
  const created = await api<Department>('/departments', adminToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return created.id
}

export async function ensureCategory(name: string, adminToken: string): Promise<number> {
  try {
    await api('/documents/categories', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  } catch {
    // already exists
  }
  const categories = await api<Category[]>('/documents/categories', adminToken)
  const category = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
  if (!category) throw new Error(`Category ${name} not found`)
  return category.id
}

export async function ensureUser(username: string, email: string, password: string, adminToken: string): Promise<number> {
  try {
    await api('/users', adminToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role: 'USER' }),
    })
  } catch {
    // already exists
  }
  const users = await api<User[]>('/users', adminToken)
  const user = users.find((u) => u.username === username)
  if (!user) throw new Error(`User ${username} not found`)
  await api(`/users/${user.id}/reset-password`, adminToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword: password }),
  })
  return user.id
}

export async function createDocumentViaApi(
  token: string,
  opts: { title: string; departmentId: number; categoryId?: number; fileName?: string; content?: string },
): Promise<Document> {
  const form = new FormData()
  form.append('title', opts.title)
  form.append('departmentId', String(opts.departmentId))
  if (opts.categoryId != null) form.append('categoryId', String(opts.categoryId))
  form.append('file', new Blob([opts.content ?? '%PDF-1.4 test content'], { type: 'application/pdf' }), opts.fileName ?? 'doc.pdf')

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  expect(res.ok).toBeTruthy()
  return (await res.json()) as Document
}

export async function loginUi(page: Page, username: string, password: string, expectSuccess = true) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  if (expectSuccess) {
    await expect(page).toHaveURL('/')
    await expect(page.locator('header[aria-label="Page heading"] h1')).toHaveText('Overview')
  }
}
