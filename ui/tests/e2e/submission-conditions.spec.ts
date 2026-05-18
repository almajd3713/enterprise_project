import { expect, test } from '@playwright/test'

type LoginResponse = { token: string }
type Department = { id: number; name: string }
type User = { id: number; username: string; departmentIds: number[] }
type Category = { id: number; name: string }
type Document = { id: number; title: string }

const API_BASE = process.env.API_BASE ?? 'http://localhost:3333/api'

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  expect(res.ok).toBeTruthy()
  const json = (await res.json()) as LoginResponse
  return json.token
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
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

async function ensureDepartment(name: string, adminToken: string): Promise<number> {
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

async function ensureUser(username: string, email: string, password: string, adminToken: string): Promise<number> {
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

async function ensureCategory(name: string, adminToken: string): Promise<number> {
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

test('Department isolation denies cross-department access and comments', async () => {
  const adminToken = await login('admin', 'admin123')

  const itId = await ensureDepartment('IT', adminToken)
  const financeId = await ensureDepartment('Finance', adminToken)

  const u1Password = 'pass1234'
  const u2Password = 'pass1234'
  const u1Id = await ensureUser('u1', 'u1@ensia.dz', u1Password, adminToken)
  const u2Id = await ensureUser('u2', 'u2@ensia.dz', u2Password, adminToken)

  await api(`/users/${u1Id}/departments`, adminToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ departmentIds: [itId] }),
  })
  await api(`/users/${u2Id}/departments`, adminToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ departmentIds: [financeId] }),
  })

  const categoryId = await ensureCategory('General', adminToken)
  const u1Token = await login('u1', u1Password)
  const u2Token = await login('u2', u2Password)

  const form = new FormData()
  form.append('title', `IT secret ${Date.now()}`)
  form.append('departmentId', String(itId))
  form.append('categoryId', String(categoryId))
  form.append('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'it.pdf')

  const upload = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u1Token}` },
    body: form,
  })
  expect(upload.ok).toBeTruthy()
  const doc = (await upload.json()) as Document

  const forbiddenGet = await fetch(`${API_BASE}/documents/get/${doc.id}`, {
    headers: { Authorization: `Bearer ${u2Token}` },
  })
  expect([401, 403]).toContain(forbiddenGet.status)

  const forbiddenComment = await fetch(`${API_BASE}/comments/add`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${u2Token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ docId: String(doc.id), content: 'Should not be accepted' }),
  })
  expect([401, 403]).toContain(forbiddenComment.status)
})

test('Upload and translation result are shown in the UI', async ({ page }) => {
  const adminToken = await login('admin', 'admin123')
  const adminDeps = await api<Department[]>('/departments', adminToken)
  const targetDep = adminDeps.find((d) => d.id === 1) ?? adminDeps[0]
  if (!targetDep) throw new Error('No department found for E2E seed')
  const categoryId = await ensureCategory('General', adminToken)
  const createdTitle = `E2E translation ${Date.now()}`
  const docForm = new FormData()
  docForm.append('title', createdTitle)
  docForm.append('departmentId', String(targetDep.id))
  docForm.append('categoryId', String(categoryId))
  docForm.append('file', new Blob(['%PDF-1.4 e2e translation'], { type: 'application/pdf' }), 'translation.pdf')
  const createRes = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: docForm,
  })
  expect(createRes.ok).toBeTruthy()
  const createdDoc = (await createRes.json()) as Document

  await page.goto('/login')
  await page.getByLabel('Username').fill('admin')
  await page.getByLabel('Password').fill('admin123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.locator('header[aria-label="Page heading"] h1')).toHaveText('Overview')
  await api(`/documents/${createdDoc.id}/translate`, adminToken, { method: 'POST' })
  await expect.poll(async () => {
    const full = await api<{
      document: { translatedText?: string | null }
    }>(`/documents/full/${createdDoc.id}`, adminToken)
    return Boolean(full.document?.translatedText && full.document.translatedText.trim().length > 0)
  }, { timeout: 60_000 }).toBeTruthy()

  await page.getByRole('link', { name: 'Documents' }).click()
  await page.getByPlaceholder('Filter by title or owner').fill(createdTitle)
  await page.getByRole('link', { name: 'Open' }).first().click()
  await expect(page.locator('p:has-text("Translated text:")')).not.toContainText('Not available')
})
