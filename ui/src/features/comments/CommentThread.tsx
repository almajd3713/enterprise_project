import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Comment } from '../../shared/types'
import { formatDate } from '../../shared/lib/format'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'

type ThreadComment = {
  id: string
  author: string
  content: string
  createdAt: string | null
}

type CommentThreadProps = {
  comments: Comment[]
  currentUser?: string
  onCreate: (content: string) => Promise<void>
  onUpdate: (commentId: string, content: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}

function extractCommentId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const raw = (value as { commentId?: unknown }).commentId
    if (typeof raw === 'string') return raw
  }
  return null
}

function parseUuidV1Date(commentId: string): string | null {
  const compact = commentId.replace(/-/g, '')
  if (!/^[0-9a-fA-F]{32}$/.test(compact)) return null
  const timeLow = BigInt(`0x${compact.slice(0, 8)}`)
  const timeMid = BigInt(`0x${compact.slice(8, 12)}`)
  const timeHiAndVersion = BigInt(`0x${compact.slice(12, 16)}`)
  const version = Number((timeHiAndVersion >> 12n) & 0xfn)
  if (version !== 1) return null
  const timestamp100ns = ((timeHiAndVersion & 0x0fffn) << 48n) | (timeMid << 32n) | timeLow
  const uuidEpochDiff100ns = 0x01b21dd213814000n
  const unix100ns = timestamp100ns - uuidEpochDiff100ns
  if (unix100ns <= 0n) return null
  const unixMs = Number(unix100ns / 10000n)
  if (!Number.isFinite(unixMs)) return null
  return new Date(unixMs).toISOString()
}

export function CommentThread({ comments, currentUser, onCreate, onUpdate, onDelete }: CommentThreadProps) {
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pending, setPending] = useState<'create' | 'update' | 'delete' | null>(null)

  const thread = useMemo<ThreadComment[]>(
    () =>
      comments
        .map((comment, index) => {
          const id = extractCommentId(comment.key?.commentId) ?? `comment-${index}`
          return {
            id,
            author: comment.author || 'Unknown',
            content: comment.content || '',
            createdAt: parseUuidV1Date(id),
          }
        })
        .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))),
    [comments],
  )

  async function submitCreate(event: FormEvent) {
    event.preventDefault()
    const content = newComment.trim()
    if (!content) return
    setPending('create')
    try {
      await onCreate(content)
      setNewComment('')
    } finally {
      setPending(null)
    }
  }

  function startEdit(comment: ThreadComment) {
    setEditingId(comment.id)
    setEditValue(comment.content)
  }

  async function saveEdit() {
    if (!editingId) return
    const content = editValue.trim()
    if (!content) return
    setPending('update')
    try {
      await onUpdate(editingId, content)
      setEditingId(null)
      setEditValue('')
    } finally {
      setPending(null)
    }
  }

  async function confirmDelete() {
    if (!deleteId) return
    setPending('delete')
    try {
      await onDelete(deleteId)
      setDeleteId(null)
    } finally {
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Comments</CardTitle>
      </CardHeader>
      <CardContent className="stack-sm">
        <p className="text-sm text-muted-foreground">{thread.length} comment{thread.length === 1 ? '' : 's'}</p>
        <ul className="comment-thread" aria-label="Document comments">
          {thread.map((comment) => (
            <li key={comment.id} className="comment-item">
              <div className="comment-head">
                <div className="comment-meta">
                  <strong>{comment.author}{currentUser && comment.author === currentUser ? ' (you)' : ''}</strong>
                  <span>{formatDate(comment.createdAt)}</span>
                  <code>ID {comment.id.slice(0, 8)}</code>
                </div>
                <div className="row-actions">
                  <Button type="button" variant="secondary" onClick={() => startEdit(comment)} disabled={pending !== null}>Edit</Button>
                  <Button type="button" variant="destructive" onClick={() => setDeleteId(comment.id)} disabled={pending !== null}>Delete</Button>
                </div>
              </div>
              {editingId === comment.id ? (
                <div className="comment-edit">
                  <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} aria-label="Edit comment" />
                  <Button type="button" onClick={saveEdit} disabled={pending !== null}>Save</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)} disabled={pending !== null}>Cancel</Button>
                </div>
              ) : (
                <p className="comment-content">{comment.content}</p>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={submitCreate} className="grid gap-2">
          <label className="grid gap-1 text-sm font-medium">
            Add comment
            <textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} rows={3} required />
          </label>
          <div className="row-actions">
            <Button type="submit" disabled={pending !== null || !newComment.trim()}>{pending === 'create' ? 'Posting...' : 'Post comment'}</Button>
          </div>
        </form>
      </CardContent>
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete comment"
        description="This action cannot be undone."
        confirmText="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  )
}
