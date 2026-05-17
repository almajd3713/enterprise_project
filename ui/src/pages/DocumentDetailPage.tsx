import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { apiDelete, apiDownload, apiGet, apiPatch, apiPost, apiUpload } from '../shared/api/http'
import type { Comment, Document } from '../shared/types'
import { PageHeader } from '../shared/ui/PageHeader'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { useToast } from '../shared/ui/ToastProvider'

type FullPayload = { document: Document; comments: Comment[] }

export function DocumentDetailPage() {
  const { pushToast } = useToast()
  const { id = '' } = useParams()
  const { data, refetch } = useQuery({
    queryKey: ['doc', id],
    queryFn: () => apiGet<FullPayload>(`/documents/full/${id}`),
    enabled: Boolean(id),
  })
  const [comment, setComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function extractCommentId(value: unknown): string | null {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      const raw = (value as { commentId?: unknown }).commentId
      if (typeof raw === 'string') return raw
      if (raw && typeof raw === 'object') {
        const low = (raw as { leastSignificantBits?: unknown }).leastSignificantBits
        const high = (raw as { mostSignificantBits?: unknown }).mostSignificantBits
        if (typeof low === 'number' && typeof high === 'number') return `${high}:${low}`
      }
    }
    return null
  }

  async function postComment(e: FormEvent) {
    e.preventDefault()
    await apiPost('/comments/add', { docId: id, content: comment })
    setComment('')
    await refetch()
    pushToast('success', 'Comment added.')
  }

  async function requestTranslation() {
    try {
      const response = await apiPost<{ message?: string }>(`/documents/${id}/translate`)
      await refetch()
      pushToast('info', response?.message ?? 'Translation requested.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Translation request failed')
    }
  }

  async function downloadFile() {
    const blob = await apiDownload(`/documents/${id}/file`)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = data?.document.fileName ?? `document-${id}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function replaceFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await apiUpload(`/documents/${id}/file`, form)
    e.currentTarget.reset()
    await refetch()
    pushToast('success', 'File replaced.')
  }

  function startEdit(target: Comment) {
    const resolvedId = extractCommentId(target.key?.commentId)
    if (!resolvedId) {
      pushToast('error', 'Invalid comment id. Refresh and try again.')
      return
    }
    setEditingId(resolvedId)
    setEditValue(target.content)
  }

  async function saveEdit() {
    if (!editingId) return
    try {
      await apiPatch(`/comments/${id}/${editingId}`, { content: editValue })
      setEditingId(null)
      setEditValue('')
      await refetch()
      pushToast('success', 'Comment updated.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Comment update failed')
    }
  }

  async function deleteComment() {
    if (!deleteId) return
    try {
      await apiDelete(`/comments/${id}/${deleteId}`)
      setDeleteId(null)
      await refetch()
      pushToast('success', 'Comment deleted.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Comment delete failed')
    }
  }

  return (
    <section className="stack-lg">
      <PageHeader title={data?.document.title ?? 'Document detail'} subtitle="Manage file, translation and discussion." />
      <section className="grid two">
        <article className="card">
          <h2>Document actions</h2>
          <p><strong>Owner:</strong> {data?.document.ownerId}</p>
          <p><strong>Department:</strong> {data?.document.departmentId ?? '-'}</p>
          <p><strong>Category:</strong> {data?.document.categoryId ?? '-'}</p>
          <p><strong>Translated text:</strong> {data?.document.translatedText || 'Not available'}</p>
          <div className="actions">
            <button type="button" onClick={requestTranslation}>Request translation</button>
            <button type="button" onClick={downloadFile}>Download file</button>
          </div>
          <form onSubmit={replaceFile} className="inline-form">
            <label>Replace file<input name="file" type="file" required /></label>
            <button type="submit">Upload replacement</button>
          </form>
        </article>
        <article className="card">
          <h2>Comments</h2>
          <ul className="list">
            {data?.comments.map((c, index) => {
              const commentId = extractCommentId(c.key?.commentId) ?? String(index)
              return (
              <li key={commentId}>
                {editingId === commentId ? (
                  <div className="comment-edit">
                    <input value={editValue} onChange={(e) => setEditValue(e.target.value)} aria-label="Edit comment" />
                    <button type="button" onClick={saveEdit}>Save</button>
                    <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span><strong>{c.author}</strong>: {c.content}</span>
                    <span className="row-actions">
                      <button type="button" className="btn-ghost" onClick={() => startEdit(c)}>Edit</button>
                      <button type="button" className="btn-danger" onClick={() => setDeleteId(commentId)}>Delete</button>
                    </span>
                  </>
                )}
              </li>
            )})}
          </ul>
          <form onSubmit={postComment}>
            <label>Add comment<input value={comment} onChange={(e) => setComment(e.target.value)} required /></label>
            <button type="submit">Post comment</button>
          </form>
        </article>
      </section>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete comment"
        description="This action cannot be undone."
        confirmText="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={deleteComment}
      />
    </section>
  )
}
