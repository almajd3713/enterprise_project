import { expect, test } from '@playwright/test'
import { api, createDocumentViaApi, ensureCategory, ensureDepartment, loginApi, loginUi, uniqueName } from './helpers'

test('Upload document via UI redirects to the created detail page', async ({ page }) => {
  const adminToken = await loginApi('admin', 'admin123')
  const depId = await ensureDepartment('E2E Upload Department', adminToken)
  const categoryId = await ensureCategory('E2E Upload Category', adminToken)

  const title = uniqueName('upload-redirect')

  await loginUi(page, 'admin', 'admin123')
  await page.getByRole('link', { name: 'Documents' }).click()
  await page.getByRole('button', { name: 'Upload document' }).click()

  await page.locator('input[name="title"]').fill(title)
  await page.locator('select[name="departmentId"]').selectOption(String(depId))
  await page.locator('select[name="categoryId"]').selectOption(String(categoryId))
  await page.locator('input[name="file"]').setInputFiles({
    name: 'upload.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 e2e upload redirect'),
  })

  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page).toHaveURL(/\/documents\/\d+$/)
  await expect(page.getByText('Manage file, translation and discussion.')).toBeVisible()
  await expect(page.locator('p:has-text("File:")')).toContainText('upload.pdf')
})

test('Document detail page loads metadata and file information', async ({ page }) => {
  const adminToken = await loginApi('admin', 'admin123')
  const depId = await ensureDepartment('E2E Detail Department', adminToken)
  const categoryId = await ensureCategory('E2E Detail Category', adminToken)

  const title = uniqueName('detail-load')
  const created = await createDocumentViaApi(adminToken, {
    title,
    departmentId: depId,
    categoryId,
    fileName: 'detail.pdf',
    content: '%PDF-1.4 detail metadata',
  })

  await loginUi(page, 'admin', 'admin123')
  await page.goto(`/documents/${created.id}`)
  await expect(page).toHaveURL(new RegExp(`/documents/${created.id}$`))

  await expect(page.getByText('Manage file, translation and discussion.')).toBeVisible()
  await expect(page.locator('section.stack-lg h1').last()).toContainText(title)
  await expect(page.locator('p:has-text("File:")')).toContainText('detail.pdf')
  await expect(page.locator('p:has-text("Department:")')).not.toContainText('-')
})

test('Upload + translation result are shown in the UI', async ({ page }) => {
  const adminToken = await loginApi('admin', 'admin123')
  const depId = await ensureDepartment('E2E Translate Department', adminToken)
  const categoryId = await ensureCategory('E2E Translate Category', adminToken)

  const createdTitle = uniqueName('translate')
  const createdDoc = await createDocumentViaApi(adminToken, {
    title: createdTitle,
    departmentId: depId,
    categoryId,
    fileName: 'translation.pdf',
    content: '%PDF-1.4 e2e translation',
  })

  await loginUi(page, 'admin', 'admin123')

  await api(`/documents/${createdDoc.id}/translate`, adminToken, { method: 'POST' })
  await expect.poll(async () => {
    const full = await api<{ document: { translatedText?: string | null } }>(`/documents/full/${createdDoc.id}`, adminToken)
    return Boolean(full.document?.translatedText && full.document.translatedText.trim().length > 0)
  }, { timeout: 60_000 }).toBeTruthy()

  await page.getByRole('link', { name: 'Documents' }).click()
  await page.getByPlaceholder('Filter by title or owner').fill(createdTitle)
  await page.getByRole('link', { name: 'Open' }).first().click()
  await expect(page).toHaveURL(/\/documents\/\d+$/)
  await expect(page.locator('p:has-text("Translated title:")')).not.toContainText('Not available')
})

test('Comments CRUD works on document detail page', async ({ page }) => {
  const adminToken = await loginApi('admin', 'admin123')
  const depId = await ensureDepartment('E2E Comments Department', adminToken)
  const categoryId = await ensureCategory('E2E Comments Category', adminToken)
  const created = await createDocumentViaApi(adminToken, {
    title: uniqueName('comments-crud'),
    departmentId: depId,
    categoryId,
  })

  const content = uniqueName('comment-create')
  const updated = uniqueName('comment-edit')

  await loginUi(page, 'admin', 'admin123')
  await page.goto(`/documents/${created.id}`)

  await page.getByLabel('Add comment').fill(content)
  await page.getByRole('button', { name: 'Post comment' }).click()
  await expect(page.locator('.comment-content')).toContainText(content)

  const commentThread = page.locator('.comment-thread')
  await commentThread.getByRole('button', { name: 'Edit' }).first().click()
  await page.getByLabel('Edit comment').fill(updated)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('.comment-content')).toContainText(updated)

  const targetComment = commentThread.locator('li.comment-item', { hasText: updated }).first()
  await targetComment.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(targetComment).toHaveCount(0)
})
