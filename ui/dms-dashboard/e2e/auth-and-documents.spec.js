import { test, expect } from '@playwright/test'

test('login and document tab visibility works', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Gateway API Base URL').fill(process.env.E2E_API_BASE || 'http://localhost:3333/api')
  await page.getByLabel('Username').fill(process.env.E2E_ADMIN_USER || 'admin')
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASS || 'admin123')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page.getByText('DMS Control Center')).toBeVisible()
  await page.getByRole('button', { name: 'Documents' }).click()
  await expect(page.getByText('Document Operations')).toBeVisible()
  await expect(page.getByText('Document List')).toBeVisible()
})
