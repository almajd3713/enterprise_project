import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from '../shared/api/http'
import type { Category, Department, Document } from '../shared/types'
import { useAuth } from '../features/auth/auth-context'
import { PageHeader } from '../shared/ui/PageHeader'
import { useToast } from '../shared/ui/ToastProvider'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { CommentThread } from '../features/comments/CommentThread'

type FullPayload = { document: Document; comments: Array<{ key: { docId: string; commentId: string }; content: string; author: string }> }
type PresignedDownload = { documentId: string; fileName: string; url: string }

export function DocumentDetailPage() {
  const { me } = useAuth()
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const [translationPending, setTranslationPending] = useState(false)
  const translationPollTimeoutRef = useRef<number | null>(null)
  const { data, refetch } = useQuery({
    queryKey: ['doc', id],
    queryFn: async () => {
      try {
        return await apiGet<FullPayload>(`/documents/full/${id}`)
      } catch {
        const document = await apiGet<Document>(`/documents/get/${id}`)
        return { document, comments: [] as FullPayload['comments'] }
      }
    },
    enabled: Boolean(id),
    refetchInterval: translationPending ? 2000 : false,
  })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => apiGet<Department[]>('/departments') })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => apiGet<Category[]>('/documents/categories') })
  const hasFile = Boolean(data?.document.fileKey)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDepartmentId, setEditDepartmentId] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')

  useEffect(() => {
    if (!data?.document) return
    setEditTitle(data.document.title ?? '')
    setEditDescription(data.document.description ?? '')
    setEditDepartmentId(data.document.departmentId != null ? String(data.document.departmentId) : '')
    setEditCategoryId(data.document.categoryId != null ? String(data.document.categoryId) : '')
  }, [data?.document])

  async function postComment(content: string) {
    await apiPost('/comments/add', { docId: id, content })
    await refetch()
    pushToast('success', 'Comment added.')
  }

  async function requestTranslation() {
    try {
      const response = await apiPost<{ message?: string }>(`/documents/${id}/translate`)
      if (translationPollTimeoutRef.current != null) {
        window.clearTimeout(translationPollTimeoutRef.current)
      }
      setTranslationPending(true)
      translationPollTimeoutRef.current = window.setTimeout(() => {
        setTranslationPending(false)
        translationPollTimeoutRef.current = null
      }, 20000)
      await refetch()
      pushToast('info', response?.message ?? 'Translation requested.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Translation request failed')
    }
  }

  useEffect(() => {
    return () => {
      if (translationPollTimeoutRef.current != null) {
        window.clearTimeout(translationPollTimeoutRef.current)
      }
    }
  }, [])

  async function loadPresignedUrl(): Promise<PresignedDownload> {
    const link = await apiGet<PresignedDownload>(`/documents/${id}/presigned-url`)
    setDownloadUrl(link.url)
    return link
  }

  async function copyDownloadLink() {
    try {
      const link = await loadPresignedUrl()
      await navigator.clipboard.writeText(link.url)
      pushToast('success', 'Download link copied.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to copy download link')
    }
  }

  async function downloadFile() {
    const first = downloadUrl ? { url: downloadUrl } as PresignedDownload : await loadPresignedUrl()
    let fileResponse = await fetch(first.url)
    if (!fileResponse.ok) {
      const refreshed = await loadPresignedUrl()
      fileResponse = await fetch(refreshed.url)
      if (!fileResponse.ok) {
        throw new Error(`Download failed (${fileResponse.status})`)
      }
    }
    const blob = await fileResponse.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = data?.document.fileName ?? `document-${id}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function replaceFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    await apiUpload(`/documents/${id}/file`, form)
    formEl.reset()
    await refetch()
    pushToast('success', 'File replaced.')
  }

  async function saveDocumentMetadata(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await apiPatch(`/documents/${id}`, {
        title: editTitle,
        description: editDescription,
        departmentId: editDepartmentId ? Number(editDepartmentId) : null,
        categoryId: editCategoryId ? Number(editCategoryId) : null,
      })
      await refetch()
      setEditMode(false)
      pushToast('success', 'Document metadata updated.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Document update failed')
    }
  }

  async function saveEdit(commentId: string, content: string) {
    try {
      await apiPatch(`/comments/${id}/${commentId}`, { content })
      await refetch()
      pushToast('success', 'Comment updated.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Comment update failed')
      throw err
    }
  }

  async function deleteComment(commentId: string) {
    try {
      await apiDelete(`/comments/${id}/${commentId}`)
      await refetch()
      pushToast('success', 'Comment deleted.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Comment delete failed')
      throw err
    }
  }

  return (
    <section className="stack-lg">
      <PageHeader
        title={data?.document.title ?? 'Document detail'}
        subtitle="Manage file, translation and discussion."
        actions={<Button type="button" variant="secondary" onClick={() => navigate('/documents')}>← Back</Button>}
      />
      <section className="grid two">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p><strong>Owner:</strong> {data?.document.ownerId}</p>
            <p><strong>Department:</strong> {data?.document.departmentId != null ? (departments.find((d) => d.id === data.document.departmentId)?.name ?? `Department #${data.document.departmentId}`) : '-'}</p>
            <p><strong>Category:</strong> {data?.document.categoryId != null ? (categories.find((c) => c.id === data.document.categoryId)?.name ?? `Category #${data.document.categoryId}`) : '-'}</p>
            <p><strong>File:</strong> {hasFile ? (data?.document.fileName ?? 'Attached') : 'No file uploaded'}</p>
            <p><strong>Description:</strong> {data?.document.description || 'Not available'}</p>
            <p><strong>Translated title:</strong> {data?.document.translatedText || 'Not available'}</p>
            <p><strong>Translated description:</strong> {data?.document.translatedDescription || 'Not available'}</p>
            <div className="actions mt-2">
              <Button type="button" onClick={requestTranslation}>Request translation</Button>
              <Button type="button" variant="secondary" onClick={downloadFile} disabled={!hasFile}>Download file</Button>
              <Button type="button" variant="secondary" onClick={copyDownloadLink} disabled={!hasFile}>Copy download link</Button>
              <Button type="button" variant="secondary" onClick={() => setEditMode((v) => !v)}>{editMode ? 'Cancel edit' : 'Edit metadata'}</Button>
            </div>
            {downloadUrl ? (
              <label className="grid gap-1 text-sm font-medium mt-1">
                Pre-signed download URL
                <Input readOnly value={downloadUrl} />
              </label>
            ) : null}
            {editMode ? (
              <form onSubmit={saveDocumentMetadata} className="grid gap-2 mt-2">
                <label className="grid gap-1 text-sm font-medium">Title<Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required /></label>
                <label className="grid gap-1 text-sm font-medium">Description<textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} /></label>
                <label className="grid gap-1 text-sm font-medium">Department<select value={editDepartmentId} onChange={(e) => setEditDepartmentId(e.target.value)}><option value="">No department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                <label className="grid gap-1 text-sm font-medium">Category<select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}><option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <Button type="submit">Save metadata</Button>
              </form>
            ) : null}
            <form onSubmit={replaceFile} className="inline-form mt-2">
              <label className="grid gap-1 text-sm font-medium">Replace file<Input name="file" type="file" required /></label>
              <Button type="submit">Upload replacement</Button>
            </form>
          </CardContent>
        </Card>
        <CommentThread comments={data?.comments ?? []} currentUser={me?.username} onCreate={postComment} onUpdate={saveEdit} onDelete={deleteComment} />
      </section>
    </section>
  )
}
