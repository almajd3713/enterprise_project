import { expect, test } from '@playwright/test'
import { API_BASE, api, createDocumentViaApi, ensureCategory, ensureDepartment, ensureUser, loginApi, uniqueName } from './helpers'

test('Department isolation denies cross-department document read access', async () => {
  const adminToken = await loginApi('admin', 'admin123')

  const itId = await ensureDepartment('IT', adminToken)
  const financeId = await ensureDepartment('Finance', adminToken)
  const categoryId = await ensureCategory('General', adminToken)

  const u1Pass = 'pass1234'
  const u2Pass = 'pass1234'
  const u1Username = uniqueName('u1')
  const u2Username = uniqueName('u2')
  const u1Id = await ensureUser(u1Username, `${u1Username}@ensia.dz`, u1Pass, adminToken)
  const u2Id = await ensureUser(u2Username, `${u2Username}@ensia.dz`, u2Pass, adminToken)

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

  const u1Token = await loginApi(u1Username, u1Pass)
  const u2Token = await loginApi(u2Username, u2Pass)

  const doc = await createDocumentViaApi(u1Token, {
    title: uniqueName('dept-private-doc'),
    departmentId: itId,
    categoryId,
  })

  const forbiddenGet = await fetch(`${API_BASE}/documents/get/${doc.id}`, {
    headers: { Authorization: `Bearer ${u2Token}` },
  })
  expect([401, 403]).toContain(forbiddenGet.status)
})

test('Department isolation denies cross-department comment creation', async () => {
  const adminToken = await loginApi('admin', 'admin123')

  const itId = await ensureDepartment('IT', adminToken)
  const financeId = await ensureDepartment('Finance', adminToken)
  const categoryId = await ensureCategory('General', adminToken)

  const u1Username = uniqueName('c1')
  const u2Username = uniqueName('c2')
  const u1Pass = 'pass1234'
  const u2Pass = 'pass1234'

  const u1Id = await ensureUser(u1Username, `${u1Username}@ensia.dz`, u1Pass, adminToken)
  const u2Id = await ensureUser(u2Username, `${u2Username}@ensia.dz`, u2Pass, adminToken)

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

  const u1Token = await loginApi(u1Username, u1Pass)
  const u2Token = await loginApi(u2Username, u2Pass)

  const doc = await createDocumentViaApi(u1Token, {
    title: uniqueName('dept-private-comment'),
    departmentId: itId,
    categoryId,
  })

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
