const DEFAULT_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

function buildUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function buildAuthHeaders(token, extra = {}) {
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function readJson(response) {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export function getDefaultBaseUrl() {
  return DEFAULT_BASE
}

export async function loginUser(baseUrl, payload) {
  const response = await fetch(buildUrl(baseUrl, '/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJson(response)
}

export async function fetchCurrentUser(baseUrl, token) {
  const response = await fetch(buildUrl(baseUrl, '/auth/me'), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function fetchDocuments(baseUrl, token) {
  const response = await fetch(buildUrl(baseUrl, '/documents/list'), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function addDocument(baseUrl, token, payload) {
  const response = await fetch(buildUrl(baseUrl, '/documents/add'), {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  return readJson(response)
}

export async function fetchDocumentFull(baseUrl, token, documentId) {
  const response = await fetch(buildUrl(baseUrl, `/documents/full/${documentId}`), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function uploadDocument(baseUrl, token, title, departmentId, categoryId, file) {
  const formData = new FormData()
  formData.append('title', title)
  formData.append('departmentId', String(departmentId))
  formData.append('categoryId', String(categoryId))
  formData.append('file', file)

  const response = await fetch(buildUrl(baseUrl, '/documents/upload'), {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: formData,
  })

  return readJson(response)
}

export async function fetchDepartments(baseUrl, token) {
  const response = await fetch(buildUrl(baseUrl, '/departments'), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function createDepartment(baseUrl, token, name) {
  const response = await fetch(buildUrl(baseUrl, '/departments'), {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name }),
  })
  return readJson(response)
}

export async function fetchCategories(baseUrl, token) {
  const response = await fetch(buildUrl(baseUrl, '/documents/categories'), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function createCategory(baseUrl, token, name) {
  const response = await fetch(buildUrl(baseUrl, '/documents/categories'), {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name }),
  })
  return readJson(response)
}

export async function attachFileToDocument(baseUrl, token, documentId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(buildUrl(baseUrl, `/documents/${documentId}/file`), {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: formData,
  })

  return readJson(response)
}

export function getDownloadDocumentFileUrl(baseUrl, documentId) {
  return buildUrl(baseUrl, `/documents/${documentId}/file`)
}

export async function getDocumentPresignedUrl(baseUrl, token, documentId) {
  const response = await fetch(buildUrl(baseUrl, `/documents/${documentId}/presigned-url`), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function deleteDocument(baseUrl, token, documentId) {
  const response = await fetch(buildUrl(baseUrl, `/documents/delete/${documentId}`), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function downloadDocumentFile(baseUrl, token, documentId) {
  const response = await fetch(buildUrl(baseUrl, `/documents/${documentId}/file`), {
    headers: buildAuthHeaders(token),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const fileName = match?.[1] || `document-${documentId}.bin`
  return { blob, fileName }
}

export async function fetchCommentsByDocument(baseUrl, token, documentId) {
  const response = await fetch(buildUrl(baseUrl, `/comments/list/${documentId}`), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function addComment(baseUrl, token, payload) {
  const response = await fetch(buildUrl(baseUrl, '/comments/add'), {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  return readJson(response)
}

export async function fetchUsers(baseUrl, token, params = {}) {
  const query = new URLSearchParams()
  if (params.query) query.set('query', params.query)
  if (params.role) query.set('role', params.role)
  if (params.active) query.set('active', params.active)

  const response = await fetch(buildUrl(baseUrl, `/users${query.toString() ? `?${query}` : ''}`), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function createUser(baseUrl, token, payload) {
  const response = await fetch(buildUrl(baseUrl, '/users'), {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return readJson(response)
}

export async function updateUserRole(baseUrl, token, userId, role) {
  const response = await fetch(buildUrl(baseUrl, `/users/${userId}/role`), {
    method: 'PATCH',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ role }),
  })
  return readJson(response)
}

export async function updateUserState(baseUrl, token, userId, active) {
  const response = await fetch(buildUrl(baseUrl, `/users/${userId}/state`), {
    method: 'PATCH',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ active }),
  })
  return readJson(response)
}

export async function resetUserPassword(baseUrl, token, userId, newPassword) {
  const response = await fetch(buildUrl(baseUrl, `/users/${userId}/reset-password`), {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ newPassword }),
  })
  return readJson(response)
}

export async function changeMyPassword(baseUrl, token, currentPassword, newPassword) {
  const response = await fetch(buildUrl(baseUrl, '/users/change-password'), {
    method: 'POST',
    headers: buildAuthHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  return readJson(response)
}

export async function queryLokiLogs(query, start, end, limit = 500) {
  const params = new URLSearchParams({
    query,
    start,
    end,
    limit: String(limit),
    direction: 'backward',
  })

  const response = await fetch(`/loki/api/v1/query_range?${params}`)
  return readJson(response)
}

export async function fetchJaegerServices() {
  const response = await fetch('/jaeger/api/services')
  return readJson(response)
}

export async function fetchSearchDocuments(baseUrl, token, params = {}) {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.departmentId) query.set('departmentId', String(params.departmentId))
  if (params.categoryId) query.set('categoryId', String(params.categoryId))
  if (params.ownerId) query.set('ownerId', String(params.ownerId))
  const response = await fetch(buildUrl(baseUrl, `/search/documents${query.toString() ? `?${query}` : ''}`), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function fetchSearchFacets(baseUrl, token) {
  const response = await fetch(buildUrl(baseUrl, '/search/facets'), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function fetchAuditEvents(baseUrl, token) {
  const response = await fetch(buildUrl(baseUrl, '/audit/events'), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}

export async function fetchAuditIntegrity(baseUrl, token) {
  const response = await fetch(buildUrl(baseUrl, '/audit/integrity-report'), {
    headers: buildAuthHeaders(token),
  })
  return readJson(response)
}
