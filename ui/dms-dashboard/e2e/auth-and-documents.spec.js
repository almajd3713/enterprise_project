import { test, expect } from '@playwright/test'

test('login and document tab visibility works', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'token-admin', username: 'admin', role: 'ADMIN' }),
    })
  })
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'admin', email: 'admin@ensia.dz', role: 'ADMIN', roles: ['ADMIN'], departmentIds: [1, 2] }),
    })
  })
  await page.route('**/api/documents/list', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, title: 'Finance Report', departmentId: 1, categoryId: 1 }]),
    })
  })
  await page.route('**/api/departments', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, name: 'Finance' }, { id: 2, name: 'IT' }]),
    })
  })
  await page.route('**/api/documents/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, name: 'General' }]),
    })
  })
  await page.route('**/api/users**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, username: 'admin', email: 'admin@ensia.dz', role: 'ADMIN', active: true }]),
    })
  })

  await page.goto('/')

  await page.getByLabel('Username').fill(process.env.E2E_ADMIN_USER || 'admin')
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASS || 'admin123')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page.getByText('DMS Control Center')).toBeVisible()
  await page.getByRole('button', { name: 'Documents' }).click()
  await expect(page.getByText('Document Operations')).toBeVisible()
  await expect(page.getByText('Document List')).toBeVisible()
})
