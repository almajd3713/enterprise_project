import { test, expect } from '@playwright/test'

test('forbidden access surfaces as error when loading unauthorized doc', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'token-operator', username: 'operator', role: 'OPERATOR' }),
    })
  })
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ username: 'operator', email: 'operator@ensia.dz', role: 'OPERATOR', roles: ['OPERATOR'], departmentIds: [1] }),
    })
  })
  await page.route('**/api/documents/list', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 10, title: 'IT Policy', departmentId: 1, categoryId: 1 }]),
    })
  })
  await page.route('**/api/departments', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, name: 'IT' }]),
    })
  })
  await page.route('**/api/documents/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1, name: 'General' }]),
    })
  })
  await page.route('**/api/documents/full/**', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'text/plain',
      body: 'Forbidden',
    })
  })

  await page.goto('/')

  await page.getByLabel('Gateway API Base URL').fill(process.env.E2E_API_BASE || 'http://localhost:3333/api')
  await page.getByLabel('Username').fill(process.env.E2E_USER_USER || 'operator')
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASS || 'operator123')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await page.getByRole('button', { name: 'Documents' }).click()
  await page.getByPlaceholder('Document id').fill(process.env.E2E_FORBIDDEN_DOC_ID || '999999')
  await page.getByRole('button', { name: 'Load Full Document' }).click()

  await expect(page.getByText(/Failed to load full document/i)).toBeVisible()
})
