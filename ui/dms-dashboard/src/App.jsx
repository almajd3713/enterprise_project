import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  addComment,
  addDocument,
  attachFileToDocument,
  changeMyPassword,
  createUser,
  createCategory,
  createDepartment,
  deleteCategory,
  deleteComment,
  deleteDepartment,
  deleteDocument,
  fetchCategories,
  fetchDepartments,
  downloadDocumentFile,
  fetchCommentsByDocument,
  fetchCurrentUser,
  fetchDocumentFull,
  fetchDocuments,
  fetchAuditEvents,
  fetchAuditIntegrity,
  fetchJaegerServices,
  fetchSearchDocuments,
  fetchSearchFacets,
  fetchUsers,
  getDefaultBaseUrl,
  getDocumentPresignedUrl,
  loginUser,
  queryLokiLogs,
  requestDocumentTranslation,
  resetUserPassword,
  updateUserRole,
  updateUserState,
  updateCategory,
  updateUserDepartments,
  updateComment,
  updateDepartment,
  uploadDocument,
} from './api/client'
import { validateSettingsDraft } from './utils/validators'

// -- Components
import LoginPage from './components/LoginPage'
import OverviewTab from './components/OverviewTab'
import DocumentsTab from './components/DocumentsTab'
import CommentsTab from './components/CommentsTab'
import SearchTab from './components/SearchTab'
import AnalyticsTab from './components/AnalyticsTab'
import GatewayTab from './components/GatewayTab'
import OperationsTab from './components/OperationsTab'
import LogsTab from './components/LogsTab'
import UsersTab from './components/UsersTab'
import SettingsTab from './components/SettingsTab'
import AuditTab from './components/AuditTab'
import ConsoleTab from './components/ConsoleTab'

// -- Constants
const ROLES = ['Admin', 'Operator', 'Analyst', 'Guest']

const ROLE_PERMISSIONS = {
  ADMIN: [
    'overview',
    'documents',
    'search',
    'comments',
    'analytics',
    'gateway',
    'operations',
    'logs',
    'console',
    'users',
    'settings',
    'audit',
  ],
  OPERATOR: ['overview', 'documents', 'search', 'comments', 'analytics', 'gateway', 'operations'],
  ANALYST: ['overview', 'documents', 'search', 'comments', 'analytics'],
  GUEST: ['overview'],
}

const TABS = [
  { id: 'overview', label: 'Dashboard', section: 'Core' },
  { id: 'documents', label: 'Documents', section: 'Core' },
  { id: 'comments', label: 'Comments', section: 'Core' },
  { id: 'search', label: 'Search', section: 'Core' },
  { id: 'users', label: 'Admin', section: 'Admin' },
  { id: 'settings', label: 'Settings', section: 'Admin' },
  { id: 'audit', label: 'Audit', section: 'Admin' },
  { id: 'analytics', label: 'Analytics', section: 'Observability' },
  { id: 'gateway', label: 'Gateway', section: 'Observability' },
  { id: 'operations', label: 'Operations', section: 'Observability' },
  { id: 'logs', label: 'Logs', section: 'Observability' },
  { id: 'console', label: 'Console', section: 'Observability' },
]

const DEFAULT_SETTINGS = {
  brandName: 'DMS Corp',
  timezone: 'UTC',
  locale: 'en-US',
  retentionDays: 90,
  notifyEmail: 'admin@dmscorp.local',
  notifyWebhook: '',
  thresholdP95: 500,
  thresholdErrorRate: 5,
  features: {
    enableSso: false,
    enableMfa: true,
    enableBetaDashboard: false,
    strictAuditMode: true,
  },
}

const FEATURE_KEYS = ['enableSso', 'enableMfa', 'enableBetaDashboard', 'strictAuditMode']

// -- Helpers
function sortByText(a, b, dir) {
  const va = String(a || '').toLowerCase()
  const vb = String(b || '').toLowerCase()
  if (va < vb) return dir === 'asc' ? -1 : 1
  if (va > vb) return dir === 'asc' ? 1 : -1
  return 0
}

function sortByNumber(a, b, dir) {
  const na = Number(a) || 0
  const nb = Number(b) || 0
  return dir === 'asc' ? na - nb : nb - na
}

function normalizeRole(roleStr) {
  if (!roleStr) return 'Guest'
  const upper = roleStr.toUpperCase()
  return ROLES.find((r) => r.toUpperCase() === upper) || 'Guest'
}

function pickTrendMultiplier(range) {
  switch (range) {
    case '1h':
      return 0.2
    case '24h':
      return 1.0
    case '7d':
      return 4.5
    case '30d':
      return 18.0
    default:
      return 1.0
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * (p / 100)
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  }
  return sorted[base]
}

function generateTraceId() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function nanoTimestampFromMs(ms) {
  return (BigInt(ms) * 1000000n).toString()
}

function inferLogLevel(message) {
  const match = String(message || '').match(/\b(ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL)\b/i)
  if (!match) return 'INFO'
  return match[1].toUpperCase().replace('WARNING', 'WARN')
}

function flattenLokiResult(payload) {
  const streams = Array.isArray(payload?.data?.result) ? payload.data.result : []
  const entries = streams.flatMap((stream) => {
    const labels = stream.stream || {}
    const service = labels.service || labels.app || labels.job || 'unknown'
    const container = labels.container || labels.instance || service

    return (stream.values || []).map(([timestamp, message]) => ({
      timestamp: Number(BigInt(timestamp) / 1000000n),
      service,
      container,
      message,
      level: inferLogLevel(message),
    }))
  })

  return entries.sort((left, right) => left.timestamp - right.timestamp).slice(-500)
}

function normalizeComment(comment) {
  const key = comment?.key || {}
  return {
    ...comment,
    id: comment?.id || key.commentId || `${comment?.docId || key.docId || 'doc'}-${Math.random().toString(16).slice(2)}`,
    docId: String(comment?.docId || key.docId || ''),
  }
}

function App() {
  // -- Auth
  const [authSession, setAuthSession] = useState(null)
  const [me, setMe] = useState(null)
  const [apiBaseUrl] = useState(getDefaultBaseUrl())
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)

  // -- UI
  const [activeTab, setActiveTab] = useState('overview')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [formIssues, setFormIssues] = useState([])

  // -- Data
  const [documents, setDocuments] = useState([])
  const [comments, setComments] = useState([])
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingFull, setLoadingFull] = useState(false)

  // -- Documents Forms
  const [newDocumentTitle, setNewDocumentTitle] = useState('')
  const [newDocumentDepartmentId, setNewDocumentDepartmentId] = useState('')
  const [newDocumentCategoryId, setNewDocumentCategoryId] = useState('')
  const [newUploadTitle, setNewUploadTitle] = useState('')
  const [newUploadDepartmentId, setNewUploadDepartmentId] = useState('')
  const [newUploadCategoryId, setNewUploadCategoryId] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [selectedDocumentDetails, setSelectedDocumentDetails] = useState(null)
  const [replaceFile, setReplaceFile] = useState(null)
  const [presignedUrlData, setPresignedUrlData] = useState(null)
  const [presignedUrlLoading, setPresignedUrlLoading] = useState(false)

  // -- Comments Forms
  const [commentDocId, setCommentDocId] = useState('')
  const [commentContent, setCommentContent] = useState('')
  const [moderationState, setModerationState] = useState({})

  // -- Users Forms
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('Analyst')
  const [newPasswordCurrent, setNewPasswordCurrent] = useState('')
  const [newPasswordNext, setNewPasswordNext] = useState('')
  const [newDepartmentName, setNewDepartmentName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingUserRole, setEditingUserRole] = useState('Analyst')
  const [editingUserActive, setEditingUserActive] = useState(true)
  const [editingUserPassword, setEditingUserPassword] = useState('')
  const [editingUserDepartments, setEditingUserDepartments] = useState([])
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState(null)
  const [userActionBusy, setUserActionBusy] = useState(false)

  // -- Context / Analytics
  const [environment, setEnvironment] = useState('docker-local')
  const [range, setRange] = useState('24h')
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(15)

  const [health, setHealth] = useState({})
  const [healthLoading, setHealthLoading] = useState(false)
  const [requestLog, setRequestLog] = useState([])
  const [operationsBusy, setOperationsBusy] = useState(false)
  const [operationHistory, setOperationHistory] = useState([])
  const [auditEvents, setAuditEvents] = useState([])
  const [auditIntegrity, setAuditIntegrity] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOwner, setSearchOwner] = useState('')
  const [searchDepartment, setSearchDepartment] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchFacets, setSearchFacets] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsDraft, setSettingsDraft] = useState({ ...DEFAULT_SETTINGS })

  // -- Logs & Traces
  const [logQuery, setLogQuery] = useState('{namespace="default"}')
  const [logResult, setLogResult] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [traceServices, setTraceServices] = useState([])
  const [tracesLoading, setTracesLoading] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState([])
  const [consoleFilter, setConsoleFilter] = useState('all')
  const [consoleLoading, setConsoleLoading] = useState(false)
  const [consoleUpdatedAt, setConsoleUpdatedAt] = useState('')

  // -- Filtering & Sorting
  const [query, setQuery] = useState('')
  const [docFileFilter, setDocFileFilter] = useState('all')
  const [docSortBy, setDocSortBy] = useState('id')
  const [docSortDir, setDocSortDir] = useState('asc')

  const [commentQuery, setCommentQuery] = useState('')
  const [commentFlagFilter, setCommentFlagFilter] = useState('all')
  const [commentSortBy, setCommentSortBy] = useState('id')
  const [commentSortDir, setCommentSortDir] = useState('desc')

  const [userQuery, setUserQuery] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStateFilter, setUserStateFilter] = useState('all')
  const [userSortBy, setUserSortBy] = useState('name')
  const [userSortDir, setUserSortDir] = useState('asc')

  // -- Computed
  const role = normalizeRole(authSession?.role)
  const allowedTabs = ROLE_PERMISSIONS[role.toUpperCase()] || ROLE_PERMISSIONS.GUEST
  const visibleTabs = TABS.filter((t) => allowedTabs.includes(t.id))
  const navSections = ['Core', 'Admin', 'Observability']
  const isAdmin = role.toUpperCase() === 'ADMIN'
  const departmentScopeIds = useMemo(
    () => (Array.isArray(me?.departmentIds) ? me.departmentIds.map(Number).filter((id) => Number.isFinite(id)) : []),
    [me?.departmentIds],
  )
  const enforceDepartmentScope = !isAdmin && departmentScopeIds.length > 0

  // -- Effects
  useEffect(() => {
    if (toast || error) {
      const timer = setTimeout(() => {
        setToast('')
        setError('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [toast, error])

  useEffect(() => {
    if (authSession?.token) {
      loadCurrentUser()
      loadDocuments()
      loadDepartments()
      loadCategories()
      runSearch()
      loadSearchFacets()
      loadAuditData()
      runDiagnostics()
      if (allowedTabs.includes('users')) {
        loadUsers()
      }
    }
  }, [authSession?.token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefreshEnabled || !authSession?.token) return
    const ms = autoRefreshSeconds * 1000
    const interval = setInterval(() => {
      loadDocuments(true)
      if (commentDocId) {
        loadCommentsForDoc(commentDocId, true)
      }
    }, ms)
    return () => clearInterval(interval)
  }, [autoRefreshEnabled, autoRefreshSeconds, authSession?.token, commentDocId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authSession?.token || !commentDocId) return
    loadCommentsForDoc(commentDocId, true)
  }, [commentDocId, authSession?.token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedDocumentId) return
    const selectedStillVisible = documents.some((doc) => {
      if (String(doc.id) !== String(selectedDocumentId)) return false
      if (!enforceDepartmentScope) return true
      return departmentScopeIds.includes(Number(doc.departmentId))
    })
    if (!selectedStillVisible) {
      setSelectedDocumentId('')
      setCommentDocId('')
      setComments([])
    }
  }, [selectedDocumentId, documents, enforceDepartmentScope, departmentScopeIds])

  // -- Functions
  async function wrapRequest(name, fn) {
    const start = Date.now()
    try {
      const result = await fn()
      setRequestLog((prev) => [...prev, { name, durationMs: Date.now() - start, ok: true }])
      return result
    } catch (err) {
      setRequestLog((prev) => [...prev, { name, durationMs: Date.now() - start, ok: false }])
      throw err
    }
  }

  function recordAudit(action, resource, details) {
    setAuditEvents((prev) => [
      {
        id: crypto.randomUUID(),
        eventId: crypto.randomUUID(),
        action,
        resourceType: resource,
        resourceId: details,
        actor: authSession?.username || 'system',
        occurredAt: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  async function handleLogin(event) {
    event.preventDefault()
    if (!loginUsername || !loginPassword) {
      setLoginError('Username and password are required.')
      return
    }

    setLoginBusy(true)
    setLoginError('')

    try {
      const data = await wrapRequest('login', () => loginUser(apiBaseUrl, { username: loginUsername, password: loginPassword }))
      setAuthSession({ token: data.token, username: data.username, role: data.role })
      setToast(`Welcome back, ${data.username}`)
      setLoginPassword('')
      recordAudit('LOGIN', 'Session', `username=${data.username} role=${data.role}`)
    } catch (err) {
      setLoginError(`Login failed: ${err.message}`)
    } finally {
      setLoginBusy(false)
    }
  }

  function handleLogout() {
    recordAudit('LOGOUT', 'Session', `username=${authSession?.username}`)
    setAuthSession(null)
    setMe(null)
    setDocuments([])
    setComments([])
    setUsers([])
    setActiveTab('overview')
    setConsoleLogs([])
    setConsoleUpdatedAt('')
    setAuditEvents([])
    setAuditIntegrity(null)
    setSearchResults([])
    setSearchFacets(null)
  }

  async function loadCurrentUser() {
    try {
      const data = await wrapRequest('fetchMe', () => fetchCurrentUser(apiBaseUrl, authSession?.token))
      setMe(data)
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }

  async function loadDocuments(silent = false) {
    if (!silent) setLoadingDocs(true)
    try {
      const data = await wrapRequest('fetchDocuments', () => fetchDocuments(apiBaseUrl, authSession?.token))
      setDocuments(data)
      if (!silent) setToast('Documents loaded.')
    } catch (err) {
      setError(`Failed to load documents: ${err.message}`)
    } finally {
      setLoadingDocs(false)
    }
  }

  async function loadCommentsForDoc(docId, silent = false) {
    if (!docId) return
    if (!silent) setLoadingComments(true)
    try {
      const data = await wrapRequest('fetchComments', () =>
        fetchCommentsByDocument(apiBaseUrl, authSession?.token, docId),
      )
      setComments(Array.isArray(data) ? data.map(normalizeComment) : [])
      if (!silent) setToast(`Comments loaded for document ${docId}.`)
    } catch (err) {
      setError(`Failed to load comments: ${err.message}`)
    } finally {
      setLoadingComments(false)
    }
  }

  async function runSearch() {
    setSearchLoading(true)
    try {
      const data = await wrapRequest('searchDocuments', () =>
        fetchSearchDocuments(apiBaseUrl, authSession?.token, {
          q: searchQuery.trim() || undefined,
          ownerId: searchOwner.trim() || undefined,
          departmentId: searchDepartment || undefined,
          categoryId: searchCategory || undefined,
        }),
      )
      setSearchResults(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(`Failed to search documents: ${err.message}`)
    } finally {
      setSearchLoading(false)
    }
  }

  async function loadSearchFacets() {
    try {
      const data = await wrapRequest('searchFacets', () => fetchSearchFacets(apiBaseUrl, authSession?.token))
      setSearchFacets(data || null)
    } catch (err) {
      setError(`Failed to load search facets: ${err.message}`)
    }
  }

  async function loadAuditData() {
    try {
      const [events, integrity] = await Promise.all([
        wrapRequest('auditEvents', () => fetchAuditEvents(apiBaseUrl, authSession?.token)),
        wrapRequest('auditIntegrity', () => fetchAuditIntegrity(apiBaseUrl, authSession?.token)),
      ])
      setAuditEvents(Array.isArray(events) ? events : [])
      setAuditIntegrity(integrity || null)
    } catch (err) {
      setError(`Failed to load audit data: ${err.message}`)
    }
  }

  async function loadUsers() {
    setLoadingUsers(true)
    try {
      const data = await wrapRequest('fetchUsers', () => fetchUsers(apiBaseUrl, authSession?.token))
      setUsers(data)
    } catch (err) {
      setError(`Failed to load users: ${err.message}`)
    } finally {
      setLoadingUsers(false)
    }
  }

  async function loadDepartments() {
    try {
      const data = await wrapRequest('fetchDepartments', () => fetchDepartments(apiBaseUrl, authSession?.token))
      setDepartments(data)
    } catch (err) {
      setError(`Failed to load departments: ${err.message}`)
    }
  }

  async function loadCategories() {
    try {
      const data = await wrapRequest('fetchCategories', () => fetchCategories(apiBaseUrl, authSession?.token))
      setCategories(data)
    } catch (err) {
      setError(`Failed to load categories: ${err.message}`)
    }
  }

  async function handleLoadFullDocument() {
    if (!selectedDocumentId) return
    setLoadingFull(true)
    setSelectedDocumentDetails(null)
    try {
      const data = await wrapRequest('fetchFullDocument', () =>
        fetchDocumentFull(apiBaseUrl, authSession?.token, selectedDocumentId),
      )
      setSelectedDocumentDetails(data)
      setToast('Full document loaded.')
      recordAudit('READ', 'DocumentFull', `docId=${selectedDocumentId}`)
    } catch (err) {
      setError(`Failed to load full document: ${err.message}`)
    } finally {
      setLoadingFull(false)
    }
  }

  async function handleCreateDocument(event) {
    event.preventDefault()
    if (!newDocumentTitle.trim() || !newDocumentDepartmentId || !newDocumentCategoryId) {
      setFormIssues(['Document title, departmentId, and categoryId are required.'])
      return
    }
    if (enforceDepartmentScope && !departmentScopeIds.includes(Number(newDocumentDepartmentId))) {
      setFormIssues(['You can only create documents inside your assigned department(s).'])
      return
    }
    setFormIssues([])
    try {
      const created = await wrapRequest('addDocument', () =>
        addDocument(apiBaseUrl, authSession?.token, {
          title: newDocumentTitle.trim(),
          departmentId: Number(newDocumentDepartmentId),
          categoryId: Number(newDocumentCategoryId),
        }),
      )
      recordAudit('CREATE', 'Document', `id=${created.id} title=${created.title}`)
      setNewDocumentTitle('')
      setNewDocumentDepartmentId('')
      setNewDocumentCategoryId('')
      setToast('Document created successfully.')
      await loadDocuments()
    } catch (err) {
      setError(`Failed to create document: ${err.message}`)
    }
  }

  async function handleUploadDocument(event) {
    event.preventDefault()
    if (!newUploadTitle.trim() || !newUploadDepartmentId || !newUploadCategoryId || !uploadFile) {
      setFormIssues(['Title, departmentId, categoryId, and file are all required for upload.'])
      return
    }
    if (enforceDepartmentScope && !departmentScopeIds.includes(Number(newUploadDepartmentId))) {
      setFormIssues(['You can only upload documents inside your assigned department(s).'])
      return
    }
    setFormIssues([])
    try {
      const created = await wrapRequest('uploadDocument', () =>
        uploadDocument(
          apiBaseUrl,
          authSession?.token,
          newUploadTitle.trim(),
          Number(newUploadDepartmentId),
          Number(newUploadCategoryId),
          uploadFile,
        ),
      )
      recordAudit('CREATE', 'DocumentWithFile', `id=${created.id} fileName=${uploadFile.name}`)
      setNewUploadTitle('')
      setNewUploadDepartmentId('')
      setNewUploadCategoryId('')
      setUploadFile(null)
      event.target.reset()
      setToast('Document uploaded successfully.')
      await loadDocuments()
    } catch (err) {
      setError(`Failed to upload document: ${err.message}`)
    }
  }

  async function handleReplaceFile(event) {
    event.preventDefault()
    if (!selectedDocumentId || !replaceFile) {
      setFormIssues(['Select a document and a file to replace/attach.'])
      return
    }
    setFormIssues([])
    try {
      await wrapRequest('attachFile', () =>
        attachFileToDocument(apiBaseUrl, authSession?.token, selectedDocumentId, replaceFile),
      )
      recordAudit('UPDATE', 'DocumentFile', `docId=${selectedDocumentId} fileName=${replaceFile.name}`)
      setReplaceFile(null)
      event.target.reset()
      setToast('File attached successfully.')
      await loadDocuments()
      await handleLoadFullDocument()
    } catch (err) {
      setError(`Failed to attach file: ${err.message}`)
    }
  }

  async function handleDownloadSelectedDocument() {
    if (!selectedDocumentId) return
    try {
      const { blob, fileName } = await wrapRequest('downloadFile', () =>
        downloadDocumentFile(apiBaseUrl, authSession?.token, selectedDocumentId),
      )
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setToast('Document file downloaded.')
    } catch (err) {
      setError(`Failed to download file: ${err.message}`)
    }
  }

  async function handleGetPresignedUrl() {
    if (!selectedDocumentId) return
    setPresignedUrlLoading(true)
    setPresignedUrlData(null)
    try {
      const data = await wrapRequest('presignedUrl', () =>
        getDocumentPresignedUrl(apiBaseUrl, authSession?.token, selectedDocumentId),
      )
      setPresignedUrlData(data)
      setToast('Pre-signed URL generated (valid 60 min).')
      recordAudit('READ', 'PresignedUrl', `docId=${selectedDocumentId}`)
    } catch (err) {
      setError(`Failed to get pre-signed URL: ${err.message}`)
    } finally {
      setPresignedUrlLoading(false)
    }
  }

  async function handleDeleteSelectedDocument() {
    if (!selectedDocumentId) return
    try {
      await wrapRequest('deleteDocument', () =>
        deleteDocument(apiBaseUrl, authSession?.token, selectedDocumentId),
      )
      recordAudit('DELETE', 'Document', `docId=${selectedDocumentId}`)
      if (commentDocId === selectedDocumentId) {
        setCommentDocId('')
        setComments([])
      }
      setSelectedDocumentId('')
      setSelectedDocumentDetails(null)
      setPresignedUrlData(null)
      setToast('Document deleted successfully.')
      await loadDocuments()
    } catch (err) {
      setError(`Failed to delete document: ${err.message}`)
    }
  }

  async function handleTranslateSelectedDocument() {
    if (!selectedDocumentId) return
    try {
      await wrapRequest('requestDocumentTranslation', () =>
        requestDocumentTranslation(apiBaseUrl, authSession?.token, selectedDocumentId),
      )
      recordAudit('REQUEST', 'DocumentTranslation', `docId=${selectedDocumentId}`)
      setToast('Translation requested. It will appear once processing completes.')
      await loadDocuments(true)
      await handleLoadFullDocument()
    } catch (err) {
      setError(`Failed to request translation: ${err.message}`)
    }
  }

  async function handleUpdateComment(comment) {
    const docId = String(comment?.docId || comment?.key?.docId || '').trim()
    const commentId = String(comment?.key?.commentId || comment?.id || '').trim()
    const content = String(comment?.content || '').trim()
    if (!docId || !commentId || !content) {
      setError('Cannot update comment: missing docId/commentId/content.')
      return
    }
    try {
      await wrapRequest('updateComment', () =>
        updateComment(apiBaseUrl, authSession?.token, docId, commentId, content),
      )
      recordAudit('UPDATE', 'Comment', `docId=${docId} commentId=${commentId}`)
      setToast('Comment updated.')
      await loadCommentsForDoc(commentDocId || docId)
    } catch (err) {
      setError(`Failed to update comment: ${err.message}`)
    }
  }

  async function handleDeleteComment(comment) {
    const docId = String(comment?.docId || comment?.key?.docId || '').trim()
    const commentId = String(comment?.key?.commentId || comment?.id || '').trim()
    if (!docId || !commentId) {
      setError('Cannot delete comment: missing docId/commentId.')
      return
    }
    try {
      await wrapRequest('deleteComment', () =>
        deleteComment(apiBaseUrl, authSession?.token, docId, commentId),
      )
      recordAudit('DELETE', 'Comment', `docId=${docId} commentId=${commentId}`)
      setToast('Comment deleted.')
      await loadCommentsForDoc(commentDocId || docId)
    } catch (err) {
      setError(`Failed to delete comment: ${err.message}`)
    }
  }

  async function handleAddComment(event) {
    event.preventDefault()
    if (!commentDocId || !commentContent.trim()) {
      setFormIssues(['Select a document and enter comment text.'])
      return
    }
    const commentDocVisible = documents.some((doc) => {
      if (String(doc.id) !== String(commentDocId)) return false
      if (!enforceDepartmentScope) return true
      return departmentScopeIds.includes(Number(doc.departmentId))
    })
    if (!commentDocVisible) {
      setFormIssues(['You can only comment on documents visible to your department scope.'])
      return
    }
    setFormIssues([])
    try {
      await wrapRequest('addComment', () =>
        addComment(apiBaseUrl, authSession?.token, {
          docId: String(commentDocId),
          content: commentContent.trim(),
        }),
      )
      recordAudit('CREATE', 'Comment', `docId=${commentDocId} content=${commentContent.trim().slice(0, 60)}`)
      setCommentContent('')
      setToast('Comment added successfully.')
      await loadCommentsForDoc(commentDocId)
    } catch (err) {
      setError(`Failed to add comment: ${err.message}`)
    }
  }

  function toggleFlag(commentId) {
    setModerationState((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }))
    recordAudit('MODERATE', 'Comment', `commentId=${commentId} flagToggled=true`)
  }

  async function handleCreateUser(event) {
    event.preventDefault()
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setFormIssues(['Name, email, and password are required.'])
      return
    }
    if (newUserPassword.trim().length < 8) {
      setFormIssues(['Password must be at least 8 characters.'])
      return
    }
    setFormIssues([])
    try {
      const created = await wrapRequest('createUser', () =>
        createUser(apiBaseUrl, authSession?.token, {
          username: newUserName.trim().toLowerCase().replace(/\s+/g, '.'),
          email: newUserEmail.trim().toLowerCase(),
          password: newUserPassword,
          role: newUserRole.toUpperCase(),
          departmentIds: [],
        }),
      )
      recordAudit('CREATE', 'User', `name=${created.username} role=${created.role}`)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserRole('Analyst')
      setNewUserPassword('')
      setToast('User created successfully.')
      await loadUsers()
    } catch (err) {
      setError(`Failed to create user: ${err.message}`)
    }
  }

  async function handleCreateDepartment(event) {
    event.preventDefault()
    if (!newDepartmentName.trim()) {
      setFormIssues(['Department name is required.'])
      return
    }
    setFormIssues([])
    try {
      const created = await wrapRequest('createDepartment', () =>
        createDepartment(apiBaseUrl, authSession?.token, newDepartmentName.trim()),
      )
      recordAudit('CREATE', 'Department', `id=${created.id} name=${created.name}`)
      setNewDepartmentName('')
      setToast('Department created.')
      await loadDepartments()
    } catch (err) {
      setError(`Failed to create department: ${err.message}`)
    }
  }

  async function handleUpdateDepartment(departmentId, name) {
    const nextName = String(name || '').trim()
    if (!nextName) {
      setFormIssues(['Department name is required.'])
      return
    }
    try {
      const updated = await wrapRequest('updateDepartment', () =>
        updateDepartment(apiBaseUrl, authSession?.token, departmentId, nextName),
      )
      recordAudit('UPDATE', 'Department', `id=${updated.id} name=${updated.name}`)
      setToast('Department updated.')
      await loadDepartments()
    } catch (err) {
      setError(`Failed to update department: ${err.message}`)
    }
  }

  async function handleDeleteDepartment(departmentId) {
    try {
      await wrapRequest('deleteDepartment', () =>
        deleteDepartment(apiBaseUrl, authSession?.token, departmentId),
      )
      recordAudit('DELETE', 'Department', `id=${departmentId}`)
      setToast('Department deleted.')
      await loadDepartments()
    } catch (err) {
      setError(`Failed to delete department: ${err.message}`)
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault()
    if (!newCategoryName.trim()) {
      setFormIssues(['Category name is required.'])
      return
    }
    setFormIssues([])
    try {
      const created = await wrapRequest('createCategory', () =>
        createCategory(apiBaseUrl, authSession?.token, newCategoryName.trim()),
      )
      recordAudit('CREATE', 'Category', `id=${created.id} name=${created.name}`)
      setNewCategoryName('')
      setToast('Category created.')
      await loadCategories()
    } catch (err) {
      setError(`Failed to create category: ${err.message}`)
    }
  }

  async function handleUpdateCategory(categoryId, name) {
    const nextName = String(name || '').trim()
    if (!nextName) {
      setFormIssues(['Category name is required.'])
      return
    }
    try {
      const updated = await wrapRequest('updateCategory', () =>
        updateCategory(apiBaseUrl, authSession?.token, categoryId, nextName),
      )
      recordAudit('UPDATE', 'Category', `id=${updated.id} name=${updated.name}`)
      setToast('Category updated.')
      await loadCategories()
    } catch (err) {
      setError(`Failed to update category: ${err.message}`)
    }
  }

  async function handleDeleteCategory(categoryId) {
    try {
      await wrapRequest('deleteCategory', () =>
        deleteCategory(apiBaseUrl, authSession?.token, categoryId),
      )
      recordAudit('DELETE', 'Category', `id=${categoryId}`)
      setToast('Category deleted.')
      await loadCategories()
    } catch (err) {
      setError(`Failed to delete category: ${err.message}`)
    }
  }

  async function updateUserRoleLocal(userId, nextRole) {
    try {
      await wrapRequest('updateRole', () =>
        updateUserRole(apiBaseUrl, authSession?.token, userId, nextRole.toUpperCase()),
      )
      recordAudit('UPDATE', 'UserRole', `userId=${userId} role=${nextRole}`)
      setToast('User role updated.')
      await loadUsers()
    } catch (err) {
      setError(`Failed to update role: ${err.message}`)
    }
  }

  async function toggleUserActive(userId, currentActive) {
    try {
      await wrapRequest('updateState', () =>
        updateUserState(apiBaseUrl, authSession?.token, userId, !currentActive),
      )
      recordAudit('UPDATE', 'UserState', `userId=${userId} activeToggled=true`)
      setToast('User state updated.')
      await loadUsers()
    } catch (err) {
      setError(`Failed to update state: ${err.message}`)
    }
  }

  async function handleResetUserPassword(userId) {
    const nextPassword = window.prompt('Enter new password (min 8 chars):')
    if (!nextPassword) return
    try {
      await wrapRequest('resetPassword', () =>
        resetUserPassword(apiBaseUrl, authSession?.token, userId, nextPassword),
      )
      recordAudit('UPDATE', 'UserPassword', `userId=${userId} reset=true`)
      setToast('User password reset.')
    } catch (err) {
      setError(`Failed to reset password: ${err.message}`)
    }
  }

  function startEditUser(user) {
    if (!user?.id) return
    setEditingUserId(user.id)
    setEditingUserRole(normalizeRole(user.role))
    setEditingUserActive(Boolean(user.active))
    setEditingUserPassword('')
    setEditingUserDepartments(
      Array.isArray(user.departmentIds)
        ? user.departmentIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [],
    )
    setPendingDeleteUserId(null)
  }

  function cancelEditUser() {
    setEditingUserId(null)
    setEditingUserRole('Analyst')
    setEditingUserActive(true)
    setEditingUserPassword('')
    setEditingUserDepartments([])
  }

  async function saveEditedUser() {
    if (!editingUserId) return
    const user = users.find((entry) => entry.id === editingUserId)
    if (!user) return

    try {
      setUserActionBusy(true)
      if (editingUserRole.toUpperCase() !== String(user.role || '').toUpperCase()) {
        await wrapRequest('updateRole', () => updateUserRole(apiBaseUrl, authSession?.token, user.id, editingUserRole.toUpperCase()))
      }
      if (editingUserActive !== Boolean(user.active)) {
        await wrapRequest('updateState', () => updateUserState(apiBaseUrl, authSession?.token, user.id, editingUserActive))
      }
      if (editingUserPassword.trim()) {
        await wrapRequest('resetPassword', () => resetUserPassword(apiBaseUrl, authSession?.token, user.id, editingUserPassword.trim()))
      }
      const currentDepartmentIds = Array.isArray(user.departmentIds)
        ? user.departmentIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)).sort((a, b) => a - b)
        : []
      const nextDepartmentIds = [...new Set(editingUserDepartments.map((id) => Number(id)).filter((id) => Number.isFinite(id)))].sort((a, b) => a - b)
      if (JSON.stringify(currentDepartmentIds) !== JSON.stringify(nextDepartmentIds)) {
        await wrapRequest('updateDepartments', () => updateUserDepartments(apiBaseUrl, authSession?.token, user.id, nextDepartmentIds))
      }
      recordAudit('UPDATE', 'User', `userId=${user.id} role=${editingUserRole} active=${editingUserActive}`)
      setToast('User updated successfully.')
      cancelEditUser()
      await loadUsers()
    } catch (err) {
      setError(`Failed to edit user: ${err.message}`)
    } finally {
      setUserActionBusy(false)
    }
  }

  function requestDeleteUser(user) {
    if (!user?.id) return
    setPendingDeleteUserId(user.id)
    setEditingUserId(null)
  }

  function cancelDeleteUser() {
    setPendingDeleteUserId(null)
  }

  async function confirmDeleteUser(user) {
    if (!user?.id) return
    try {
      setUserActionBusy(true)
      await wrapRequest('softDeleteUser', () => updateUserState(apiBaseUrl, authSession?.token, user.id, false))
      recordAudit('DELETE', 'User', `userId=${user.id} softDelete=true`)
      setToast('User soft-deleted (account disabled).')
      setPendingDeleteUserId(null)
      await loadUsers()
    } catch (err) {
      setError(`Failed to delete user: ${err.message}`)
    } finally {
      setUserActionBusy(false)
    }
  }

  async function handleChangeMyPassword(event) {
    event.preventDefault()
    if (!newPasswordCurrent || !newPasswordNext) {
      setFormIssues(['Current and new password are required.'])
      return
    }
    try {
      await wrapRequest('changePassword', () =>
        changeMyPassword(apiBaseUrl, authSession?.token, newPasswordCurrent, newPasswordNext),
      )
      setNewPasswordCurrent('')
      setNewPasswordNext('')
      setFormIssues([])
      setToast('Password changed successfully.')
    } catch (err) {
      setError(`Failed to change password: ${err.message}`)
    }
  }

  function handleSettingsChange(field, value) {
    setSettingsDraft((prev) => ({ ...prev, [field]: value }))
  }

  function handleFeatureToggle(featureKey, value) {
    setSettingsDraft((prev) => ({
      ...prev,
      features: { ...prev.features, [featureKey]: value },
    }))
  }

  function saveSettings(event) {
    event.preventDefault()
    const issues = validateSettingsDraft(settingsDraft)
    if (issues.length) {
      setFormIssues(issues)
      return
    }
    setFormIssues([])
    setSettings(settingsDraft)
    recordAudit('UPDATE', 'Settings', `timezone=${settingsDraft.timezone} retention=${settingsDraft.retentionDays}`)
    setToast('Settings saved.')
  }

  function clearDocumentFilters() {
    setQuery('')
    setDocFileFilter('all')
    setDocSortBy('id')
    setDocSortDir('asc')
  }

  function clearCommentFilters() {
    setCommentQuery('')
    setCommentFlagFilter('all')
    setCommentSortBy('id')
    setCommentSortDir('desc')
  }

  function clearUserFilters() {
    setUserQuery('')
    setUserRoleFilter('all')
    setUserStateFilter('all')
    setUserSortBy('name')
    setUserSortDir('asc')
  }

  function exportAuditLog() {
    const blob = new Blob([JSON.stringify(auditEvents, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `audit-log-${new Date().toISOString()}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function runDiagnostics() {
    setHealthLoading(true)
    try {
      const traceId = generateTraceId()
      const dStart = Date.now()
      let docsOk = false
      try {
        await fetch(`${apiBaseUrl}/documents/list`, {
          headers: {
            ...(authSession?.token ? { Authorization: `Bearer ${authSession.token}` } : {}),
            'x-b3-traceid': traceId,
          },
        })
        docsOk = true
      } catch {
        // Keep probing the remaining services so the dashboard can report a partial health picture.
      }

      const cStart = Date.now()
      let commentsOk = false
      try {
        if (selectedDocumentId) {
          await fetch(`${apiBaseUrl}/comments/list/${selectedDocumentId}`, {
            headers: {
              ...(authSession?.token ? { Authorization: `Bearer ${authSession.token}` } : {}),
              'x-b3-traceid': traceId,
            },
          })
        } else {
          await fetch(`${apiBaseUrl}/comments/list/1`, {
            headers: {
              ...(authSession?.token ? { Authorization: `Bearer ${authSession.token}` } : {}),
              'x-b3-traceid': traceId,
            },
          })
        }
        commentsOk = true
      } catch {
        // Keep probing the remaining services so the dashboard can report a partial health picture.
      }

      const fStart = Date.now()
      let fullOk = false
      try {
        const fullId = selectedDocumentId || '1'
        await fetch(`${apiBaseUrl}/documents/full/${fullId}`, {
          headers: {
            ...(authSession?.token ? { Authorization: `Bearer ${authSession.token}` } : {}),
            'x-b3-traceid': traceId,
          },
        })
        fullOk = true
      } catch {
        // Keep probing the remaining services so the dashboard can report a partial health picture.
      }

      setHealth({
        gateway: { status: 'online', code: 200, latencyMs: Date.now() - dStart },
        documents: { status: docsOk ? 'online' : 'offline', latencyMs: Date.now() - dStart },
        comments: { status: commentsOk ? 'online' : 'offline', latencyMs: Date.now() - cStart },
        fullflow: { status: fullOk ? 'online' : 'degraded', latencyMs: Date.now() - fStart },
        updatedAt: new Date().toLocaleTimeString(),
      })
      setToast('Diagnostics complete.')
    } catch {
      setHealth({ gateway: { status: 'offline', code: 500, latencyMs: 0 } })
    } finally {
      setHealthLoading(false)
    }
  }

  async function runOperation(name, actionFn) {
    setOperationsBusy(true)
    const start = Date.now()
    try {
      const msg = await actionFn()
      setOperationHistory((prev) => [
        {
          id: crypto.randomUUID(),
          name,
          status: 'success',
          details: msg || `Completed in ${Date.now() - start}ms`,
          at: new Date().toLocaleTimeString(),
        },
        ...prev,
      ])
      setToast(`Operation '${name}' completed.`)
      recordAudit('EXECUTE', 'Operation', `name=${name} status=success`)
    } catch (err) {
      setOperationHistory((prev) => [
        {
          id: crypto.randomUUID(),
          name,
          status: 'failed',
          details: err.message,
          at: new Date().toLocaleTimeString(),
        },
        ...prev,
      ])
      setError(`Operation '${name}' failed: ${err.message}`)
      recordAudit('EXECUTE', 'Operation', `name=${name} status=failed`)
    } finally {
      setOperationsBusy(false)
    }
  }

  async function handleWarmupFlow() {
    if (documents.length === 0) {
      throw new Error('No documents available to warm up flow.')
    }
    const docId = documents[0].id
    await fetchDocumentFull(apiBaseUrl, authSession?.token, docId)
    return `Warmed full flow for document ${docId}`
  }

  async function queryLoki() {
    setLogsLoading(true)
    try {
      const end = nanoTimestampFromMs(Date.now())
      const start = nanoTimestampFromMs(Date.now() - 60 * 60 * 1000)
      const payload = await wrapRequest('queryLoki', () => queryLokiLogs(logQuery, start, end, 200))
      setLogResult(flattenLokiResult(payload))
      setToast('Logs fetched successfully.')
    } catch (err) {
      setError(`Loki query failed: ${err.message}`)
    } finally {
      setLogsLoading(false)
    }
  }

  async function loadTracesServices() {
    setTracesLoading(true)
    try {
      const payload = await wrapRequest('fetchJaegerServices', () => fetchJaegerServices())
      const services = Array.isArray(payload?.data) ? payload.data : []
      setTraceServices(services)
      setToast(services.length ? 'Jaeger services loaded.' : 'Jaeger is reachable, but no traced services were found yet.')
    } catch (err) {
      setError(`Failed to load trace services: ${err.message}`)
    } finally {
      setTracesLoading(false)
    }
  }

  async function refreshConsoleLogs() {
    setConsoleLoading(true)
    try {
      const serviceQuery = consoleFilter === 'all' ? '{service=~".+"}' : `{service="${consoleFilter}"}`
      const end = nanoTimestampFromMs(Date.now())
      const start = nanoTimestampFromMs(Date.now() - 60 * 60 * 1000)
      const payload = await wrapRequest('refreshConsoleLogs', () => queryLokiLogs(serviceQuery, start, end, 500))
      setConsoleLogs(flattenLokiResult(payload))
      setConsoleUpdatedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(`Console log refresh failed: ${err.message}`)
    } finally {
      setConsoleLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'console' || !authSession?.token) return

    refreshConsoleLogs()
    const interval = setInterval(() => {
      refreshConsoleLogs()
    }, 15000)

    return () => clearInterval(interval)
  }, [activeTab, authSession?.token, consoleFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // -- Memos (Filtering)
  const visibleDocuments = useMemo(() => {
    if (!enforceDepartmentScope) return documents
    return documents.filter((doc) => departmentScopeIds.includes(Number(doc.departmentId)))
  }, [documents, enforceDepartmentScope, departmentScopeIds])

  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase()
    const next = visibleDocuments.filter((doc) => {
      const matchesQuery =
        !q ||
        [doc.title, doc.fileName, String(doc.id)].some((field) =>
          String(field || '')
            .toLowerCase()
            .includes(q),
        )

      const hasFile = Boolean(String(doc.fileName || '').trim())
      const matchesFileFilter =
        docFileFilter === 'all' ||
        (docFileFilter === 'withFile' && hasFile) ||
        (docFileFilter === 'withoutFile' && !hasFile)

      return matchesQuery && matchesFileFilter
    })

    return [...next].sort((left, right) => {
      if (docSortBy === 'id') return sortByNumber(left.id, right.id, docSortDir)
      if (docSortBy === 'title') return sortByText(left.title, right.title, docSortDir)
      return sortByText(left.fileName, right.fileName, docSortDir)
    })
  }, [visibleDocuments, query, docFileFilter, docSortBy, docSortDir])

  const visibleDepartments = useMemo(() => {
    if (!enforceDepartmentScope) return departments
    return departments.filter((department) => departmentScopeIds.includes(Number(department.id)))
  }, [departments, enforceDepartmentScope, departmentScopeIds])

  const filteredComments = useMemo(() => {
    const q = commentQuery.trim().toLowerCase()
    const next = comments.filter((comment) => {
      const matchesQuery =
        !q ||
        [comment.content, String(comment.id), String(comment.docId)].some((field) =>
          String(field || '')
            .toLowerCase()
            .includes(q),
        )

      const isFlagged = Boolean(moderationState[comment.id])
      const matchesFlag =
        commentFlagFilter === 'all' ||
        (commentFlagFilter === 'flagged' && isFlagged) ||
        (commentFlagFilter === 'clean' && !isFlagged)

      return matchesQuery && matchesFlag
    })

    return [...next].sort((left, right) => {
      if (commentSortBy === 'docId') return sortByNumber(left.docId, right.docId, commentSortDir)
      if (commentSortBy === 'content') return sortByText(left.content, right.content, commentSortDir)
      return sortByNumber(left.id, right.id, commentSortDir)
    })
  }, [comments, commentQuery, commentFlagFilter, commentSortBy, commentSortDir, moderationState])

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    const next = users.filter((user) => {
      const matchesQuery =
        !q ||
        [user.username, user.email, user.role].some((field) =>
          String(field || '')
            .toLowerCase()
            .includes(q),
        )

      const matchesRole =
        userRoleFilter === 'all' ||
        String(user.role || '').toLowerCase() === String(userRoleFilter || '').toLowerCase()
      const matchesState =
        userStateFilter === 'all' ||
        (userStateFilter === 'active' && user.active) ||
        (userStateFilter === 'disabled' && !user.active)

      return matchesQuery && matchesRole && matchesState
    })

    return [...next].sort((left, right) => {
      if (userSortBy === 'email') return sortByText(left.email, right.email, userSortDir)
      if (userSortBy === 'role') return sortByText(left.role, right.role, userSortDir)
      return sortByText(left.username, right.username, userSortDir)
    })
  }, [users, userQuery, userRoleFilter, userStateFilter, userSortBy, userSortDir])

  const flaggedCount = useMemo(
    () => comments.filter((comment) => Boolean(moderationState[comment.id])).length,
    [comments, moderationState],
  )

  const analytics = useMemo(() => {
    const multiplier = pickTrendMultiplier(range)
    const baseDocs = documents.length
    const baseComments = comments.length
    const points = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
      const docsValue = Math.max(0, Math.round((baseDocs + idx + 1) * (0.35 * multiplier)))
      const commentsValue = Math.max(0, Math.round((baseComments + idx * 2 + 1) * (0.45 * multiplier)))
      return { day, docsValue, commentsValue }
    })

    const totalReq = requestLog.length
    const failed = requestLog.filter((entry) => !entry.ok).length
    const durations = requestLog.map((entry) => entry.durationMs).filter((d) => d > 0)

    return {
      points,
      totalReq,
      failed,
      successRate: totalReq ? (((totalReq - failed) / totalReq) * 100).toFixed(1) : '100.0',
      p95: Math.round(percentile(durations, 95)),
      avgLatency: durations.length
        ? Math.round(durations.reduce((acc, val) => acc + val, 0) / durations.length)
        : 0,
    }
  }, [documents.length, comments.length, range, requestLog])

  // -- Render
  if (!authSession?.token) {
    return (
      <LoginPage
        loginUsername={loginUsername}
        setLoginUsername={setLoginUsername}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        loginBusy={loginBusy}
        loginError={loginError}
        handleLogin={handleLogin}
      />
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="brand-eyebrow">Enterprise Reel</p>
          <h1>DMS Control Center</h1>
        </div>

        <div className="field small">
          <span>Signed in user</span>
          <p><strong>{authSession.username}</strong> ({role})</p>
          <p className="small-note">{me?.email || 'email unavailable'}</p>
          {/* <button
            className="btn ghost"
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(authSession.token)
              setToast('Access token copied to clipboard.')
            }}
          >
            Copy Token
          </button> */}
          <button className="btn ghost top-gap" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <nav className="nav-grid" aria-label="Dashboard tabs">
          {navSections.map((section) => {
            const tabs = visibleTabs.filter((tab) => tab.section === section)
            if (tabs.length === 0) return null
            return (
              <div key={section} className="nav-section">
                <p className="nav-section-label">{section}</p>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={tab.id === activeTab ? 'nav-item active' : 'nav-item'}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeTab === 'documents'
                ? 'Search documents by id, title, or filename'
                : 'Document search is active in the Documents tab'
            }
            disabled={activeTab !== 'documents'}
            aria-label="Document search"
          />

          <label className="field inline">
            <span>Environment</span>
            <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
              <option value="k8s-local">K8s local</option>
              <option value="docker-local">Docker local</option>
              <option value="staging">Staging</option>
            </select>
          </label>

          <label className="field inline">
            <span>Time Range</span>
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="1h">1h</option>
              <option value="24h">24h</option>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
            </select>
          </label>

          <label className="field inline">
            <span>Auto Refresh</span>
            <select
              value={autoRefreshEnabled ? String(autoRefreshSeconds) : 'off'}
              onChange={(e) => {
                if (e.target.value === 'off') {
                  setAutoRefreshEnabled(false)
                  return
                }
                setAutoRefreshEnabled(true)
                setAutoRefreshSeconds(Number(e.target.value))
              }}
            >
              <option value="off">Off</option>
              <option value="15">15s</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
            </select>
          </label>
        </header>

        {toast && <p className="toast ok" role="status" aria-live="polite">{toast}</p>}
        {error && <p className="toast err" role="alert" aria-live="assertive">{error}</p>}
        {formIssues.length > 0 && (
          <div className="toast warn" role="alert" aria-live="assertive">
            {formIssues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        )}

        {/* --- Tabs --- */}
        {activeTab === 'overview' && (
          <OverviewTab
            documents={visibleDocuments}
            comments={comments}
            environment={environment}
            role={role}
            range={range}
            health={health}
            healthLoading={healthLoading}
            runDiagnostics={runDiagnostics}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentsTab
            documents={visibleDocuments}
            filteredDocuments={filteredDocuments}
            loadingDocs={loadingDocs}
            selectedDocumentId={selectedDocumentId}
            setSelectedDocumentId={setSelectedDocumentId}
            setCommentDocId={setCommentDocId}
            selectedDocumentDetails={selectedDocumentDetails}
            loadingFull={loadingFull}
            docFileFilter={docFileFilter}
            setDocFileFilter={setDocFileFilter}
            docSortBy={docSortBy}
            setDocSortBy={setDocSortBy}
            docSortDir={docSortDir}
            setDocSortDir={setDocSortDir}
            clearDocumentFilters={clearDocumentFilters}
            newDocumentTitle={newDocumentTitle}
            setNewDocumentTitle={setNewDocumentTitle}
            newDocumentDepartmentId={newDocumentDepartmentId}
            setNewDocumentDepartmentId={setNewDocumentDepartmentId}
            newDocumentCategoryId={newDocumentCategoryId}
            setNewDocumentCategoryId={setNewDocumentCategoryId}
            newUploadTitle={newUploadTitle}
            setNewUploadTitle={setNewUploadTitle}
            newUploadDepartmentId={newUploadDepartmentId}
            setNewUploadDepartmentId={setNewUploadDepartmentId}
            newUploadCategoryId={newUploadCategoryId}
            setNewUploadCategoryId={setNewUploadCategoryId}
            uploadFile={uploadFile}
            setUploadFile={setUploadFile}
            replaceFile={replaceFile}
            setReplaceFile={setReplaceFile}
            presignedUrlData={presignedUrlData}
            setPresignedUrlData={setPresignedUrlData}
            presignedUrlLoading={presignedUrlLoading}
            handleCreateDocument={handleCreateDocument}
            handleUploadDocument={handleUploadDocument}
            handleLoadFullDocument={handleLoadFullDocument}
            handleReplaceFile={handleReplaceFile}
            handleDownloadSelectedDocument={handleDownloadSelectedDocument}
            handleGetPresignedUrl={handleGetPresignedUrl}
            handleTranslateSelectedDocument={handleTranslateSelectedDocument}
            handleDeleteSelectedDocument={handleDeleteSelectedDocument}
            role={role}
            departments={visibleDepartments}
            categories={categories}
            enforceDepartmentScope={enforceDepartmentScope}
          />
        )}

        {activeTab === 'search' && (
          <SearchTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchOwner={searchOwner}
            setSearchOwner={setSearchOwner}
            searchDepartment={searchDepartment}
            setSearchDepartment={setSearchDepartment}
            searchCategory={searchCategory}
            setSearchCategory={setSearchCategory}
            departments={departments}
            categories={categories}
            searchResults={searchResults}
            searchFacets={searchFacets}
            searchLoading={searchLoading}
            runSearch={runSearch}
            loadSearchFacets={loadSearchFacets}
          />
        )}

        {activeTab === 'comments' && (
          <CommentsTab
            documents={visibleDocuments}
            setCommentDocId={setCommentDocId}
            commentDocId={commentDocId}
            commentContent={commentContent}
            setCommentContent={setCommentContent}
            commentQuery={commentQuery}
            setCommentQuery={setCommentQuery}
            commentFlagFilter={commentFlagFilter}
            setCommentFlagFilter={setCommentFlagFilter}
            commentSortBy={commentSortBy}
            setCommentSortBy={setCommentSortBy}
            commentSortDir={commentSortDir}
            setCommentSortDir={setCommentSortDir}
            comments={comments}
            filteredComments={filteredComments}
            loadingComments={loadingComments}
            flaggedCount={flaggedCount}
            moderationState={moderationState}
            toggleFlag={toggleFlag}
            clearCommentFilters={clearCommentFilters}
            handleAddComment={handleAddComment}
            loadCommentsForDoc={loadCommentsForDoc}
            role={role}
            enforceDepartmentScope={enforceDepartmentScope}
            handleUpdateComment={handleUpdateComment}
            handleDeleteComment={handleDeleteComment}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsTab analytics={analytics} />}

        {activeTab === 'gateway' && (
          <GatewayTab
            analytics={analytics}
            health={health}
            runDiagnostics={runDiagnostics}
          />
        )}

        {activeTab === 'operations' && (
          <OperationsTab
            operationsBusy={operationsBusy}
            runOperation={runOperation}
            loadDocuments={loadDocuments}
            loadCommentsForDoc={loadCommentsForDoc}
            commentDocId={commentDocId}
            runDiagnostics={runDiagnostics}
            handleWarmupFlow={handleWarmupFlow}
            setError={setError}
            setToast={setToast}
            operationHistory={operationHistory}
          />
        )}

        {activeTab === 'logs' && (
          <LogsTab
            logQuery={logQuery}
            setLogQuery={setLogQuery}
            queryLoki={queryLoki}
            logsLoading={logsLoading}
            logResult={logResult}
            loadTracesServices={loadTracesServices}
            tracesLoading={tracesLoading}
            traceServices={traceServices}
          />
        )}

        {activeTab === 'console' && (
          <ConsoleTab
            logs={consoleLogs}
            filter={consoleFilter}
            setFilter={setConsoleFilter}
            clearLogs={() => setConsoleLogs([])}
            refreshLogs={refreshConsoleLogs}
            loading={consoleLoading}
            lastUpdatedAt={consoleUpdatedAt}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            handleCreateUser={handleCreateUser}
            newUserName={newUserName}
            setNewUserName={setNewUserName}
            newUserEmail={newUserEmail}
            setNewUserEmail={setNewUserEmail}
            newUserPassword={newUserPassword}
            setNewUserPassword={setNewUserPassword}
            newUserRole={newUserRole}
            setNewUserRole={setNewUserRole}
            handleChangeMyPassword={handleChangeMyPassword}
            newPasswordCurrent={newPasswordCurrent}
            setNewPasswordCurrent={setNewPasswordCurrent}
            newPasswordNext={newPasswordNext}
            setNewPasswordNext={setNewPasswordNext}
            users={users}
            filteredUsers={filteredUsers}
            loadingUsers={loadingUsers}
            userQuery={userQuery}
            setUserQuery={setUserQuery}
            userRoleFilter={userRoleFilter}
            setUserRoleFilter={setUserRoleFilter}
            userStateFilter={userStateFilter}
            setUserStateFilter={setUserStateFilter}
            userSortBy={userSortBy}
            setUserSortBy={setUserSortBy}
            userSortDir={userSortDir}
            setUserSortDir={setUserSortDir}
            clearUserFilters={clearUserFilters}
            loadUsers={loadUsers}
            updateUserRoleLocal={updateUserRoleLocal}
            toggleUserActive={toggleUserActive}
            handleResetUserPassword={handleResetUserPassword}
            startEditUser={startEditUser}
            cancelEditUser={cancelEditUser}
            saveEditedUser={saveEditedUser}
            editingUserId={editingUserId}
            editingUserRole={editingUserRole}
            setEditingUserRole={setEditingUserRole}
            editingUserActive={editingUserActive}
            setEditingUserActive={setEditingUserActive}
            editingUserPassword={editingUserPassword}
            setEditingUserPassword={setEditingUserPassword}
            editingUserDepartments={editingUserDepartments}
            setEditingUserDepartments={setEditingUserDepartments}
            requestDeleteUser={requestDeleteUser}
            confirmDeleteUser={confirmDeleteUser}
            cancelDeleteUser={cancelDeleteUser}
            pendingDeleteUserId={pendingDeleteUserId}
            userActionBusy={userActionBusy}
            handleUpdateDepartment={handleUpdateDepartment}
            handleDeleteDepartment={handleDeleteDepartment}
            handleUpdateCategory={handleUpdateCategory}
            handleDeleteCategory={handleDeleteCategory}
            handleCreateDepartment={handleCreateDepartment}
            newDepartmentName={newDepartmentName}
            setNewDepartmentName={setNewDepartmentName}
            handleCreateCategory={handleCreateCategory}
            newCategoryName={newCategoryName}
            setNewCategoryName={setNewCategoryName}
            departments={departments}
            categories={categories}
            loadDepartments={loadDepartments}
            loadCategories={loadCategories}
            ROLES={ROLES}
            ROLE_PERMISSIONS={ROLE_PERMISSIONS}
            normalizeRole={normalizeRole}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settingsDraft={settingsDraft}
            handleSettingsChange={handleSettingsChange}
            handleFeatureToggle={handleFeatureToggle}
            saveSettings={saveSettings}
            FEATURE_KEYS={FEATURE_KEYS}
            settings={settings}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTab
            auditEvents={auditEvents}
            auditIntegrity={auditIntegrity}
            exportAuditLog={exportAuditLog}
            loadAuditData={loadAuditData}
          />
        )}
      </main>
    </div>
  )
}

export default App
