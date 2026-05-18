import { expect, test } from '@playwright/test'
import { loginUi } from './helpers'

test('Login success loads overview dashboard', async ({ page }) => {
  await loginUi(page, 'admin', 'admin123')
})

test('Login failure shows an inline error and stays on login page', async ({ page }) => {
  await loginUi(page, 'admin', 'wrong-password', false)
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toContainText(/failed|invalid|unauthorized/i)
})
