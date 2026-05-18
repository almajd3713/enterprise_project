export type LoginResponse = {
  token: string
  username: string
  role: string
  roles: string[]
  permissions: string[]
}

export type MeResponse = {
  username: string
  email: string
  active: boolean
  lastLoginAt: string | null
  lastLogoutAt: string | null
  role: string
  roles: string[]
  departmentIds: number[]
  permissions: string[]
}

export type Document = {
  id: number
  title: string
  description: string | null
  fileName: string | null
  fileKey: string | null
  contentType: string | null
  fileSize: number | null
  ownerId: string
  departmentId: number | null
  categoryId: number | null
  translatedText: string | null
  translatedDescription: string | null
}

export type SearchResult = {
  documentId: number
  title: string
  description: string | null
  translatedText: string | null
  translatedDescription: string | null
  ownerId: string
  departmentId: number | null
  categoryId: number | null
  fileName: string | null
  contentType: string | null
  fileSize: number | null
  updatedAt: string | null
}

export type Category = { id: number; name: string }
export type Department = { id: number; name: string }

export type User = {
  id: number
  username: string
  email: string
  role: string
  roles: string[]
  departmentIds: number[]
  active: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  lastLogoutAt: string | null
}

export type Comment = {
  key: { docId: string; commentId: string }
  docId?: string
  content: string
  author: string
}

export type AuditEvent = {
  id: string | number
  eventId?: string
  actor: string
  action: string
  entityType?: string
  entityId?: string
  resourceType?: string
  resourceId?: string
  departmentId: number | null
  metadataJson: string
  integrityHash?: string
  eventHash?: string
  createdAt?: string
  occurredAt?: string
}

export type ConsoleLogEntry = {
  service: string
  timestampNs: string
  timestampIso: string
  stream: string
  container: string
  line: string
}

export type AdminConsoleResponse = {
  availableServices: string[]
  selectedServices: string[]
  entries: ConsoleLogEntry[]
}
