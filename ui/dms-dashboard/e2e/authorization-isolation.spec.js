import { test, expect } from '@playwright/test'

test('forbidden access surfaces as error when loading unauthorized doc', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Gateway API Base URL').fill(process.env.E2E_API_BASE || 'http://localhost:3333/api')
  await page.getByLabel('Username').fill(process.env.E2E_USER_USER || 'user')
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASS || 'user123')
  await page.getByRole('button', { name: 'Sign In' }).click()

  await page.getByRole('button', { name: 'Documents' }).click()
  await page.getByPlaceholder('Document id').fill(process.env.E2E_FORBIDDEN_DOC_ID || '999999')
  await page.getByRole('button', { name: 'Load Full Document' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
})
