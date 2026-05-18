import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from '../shared/api/http'
import type { Category, Department, Document } from '../shared/types'
import { prettyBytes } from '../shared/lib/format'
import { ConfirmDialog } from '../shared/ui/ConfirmDialog'
import { DataGrid } from '../shared/ui/DataGrid'
import { EmptyState } from '../shared/ui/EmptyState'
import { PageHeader } from '../shared/ui/PageHeader'
import { EntityDrawer } from '../shared/ui/EntityDrawer'
import { useToast } from '../shared/ui/ToastProvider'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

export function DocumentsPage() {
  const { pushToast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, error, isLoading } = useQuery({ queryKey: ['documents'], queryFn: () => apiGet<Document[]>('/documents/list') })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => apiGet<Department[]>('/departments') })
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => apiGet<Category[]>('/documents/categories') })
  const departmentNameById = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments])
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [q, setQ] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [editing, setEditing] = useState<Document | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDepartmentId, setEditDepartmentId] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [targetDelete, setTargetDelete] = useState<Document | null>(null)

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim()
    return (data ?? []).filter((d) => d.title.toLowerCase().includes(query) || d.ownerId.toLowerCase().includes(query))
  }, [data, q])

  async function createDoc(e: FormEvent) {
    e.preventDefault()
    try {
      await apiPost('/documents/add', { title, description, departmentId: departmentId ? Number(departmentId) : null, categoryId: categoryId ? Number(categoryId) : null })
      setTitle('')
      setDescription('')
      setDepartmentId('')
      setCategoryId('')
      setCreateOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['documents'] })
      pushToast('success', 'Document metadata created.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Create failed')
    }
  }

  async function uploadDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    try {
      const form = new FormData(formEl)
      const uploaded = await apiUpload<Document>('/documents/upload', form)
      formEl.reset()
      setUploadOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['documents'] })
      pushToast('success', 'Document uploaded.')
      if (uploaded?.id != null) {
        navigate(`/documents/${uploaded.id}`)
        return
      }
      // Fallback: when backend response payload is incomplete, navigate to the most recent item in refreshed list.
      const refreshed = await apiGet<Document[]>('/documents/list')
      if (refreshed.length > 0) {
        navigate(`/documents/${refreshed[0].id}`)
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Upload failed')
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    try {
      await apiPatch(`/documents/${editing.id}`, {
        title: editTitle,
        description: editDescription,
        departmentId: editDepartmentId ? Number(editDepartmentId) : null,
        categoryId: editCategoryId ? Number(editCategoryId) : null,
      })
      setEditing(null)
      setEditTitle('')
      setEditDescription('')
      setEditDepartmentId('')
      setEditCategoryId('')
      await queryClient.invalidateQueries({ queryKey: ['documents'] })
      pushToast('success', 'Document metadata updated.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Update failed')
    }
  }

  async function deleteDoc() {
    if (!targetDelete) return
    try {
      await apiDelete(`/documents/${targetDelete.id}`)
      setTargetDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['documents'] })
      pushToast('success', 'Document deleted.')
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <section className="stack-lg">
      <PageHeader
        title="Document Library"
        subtitle="Search, create metadata, and upload files in one workspace."
        actions={<div className="row-actions"><Button type="button" variant="secondary" onClick={() => setCreateOpen(true)}>Create metadata</Button><Button type="button" onClick={() => setUploadOpen(true)}>Upload document</Button></div>}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="grid gap-1 text-sm font-medium">Quick filter<Input placeholder="Filter by title or owner" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}
          {isLoading ? <p className="text-sm text-muted-foreground">Loading documents...</p> : null}
          {!isLoading && filtered.length === 0 ? <EmptyState title="No documents found" body="Try a different query or upload a new document." /> : null}
          {filtered.length > 0 ? (
            <DataGrid
              title="Documents"
              rows={filtered}
              rowKey={(r) => r.id}
              empty={<EmptyState title="No documents" body="No documents available." />}
              columns={[
                { id: 'title', label: 'Title', sortable: true, sortValue: (r) => r.title, render: (r) => r.title },
                { id: 'ownerId', label: 'Owner', sortable: true, sortValue: (r) => r.ownerId, render: (r) => r.ownerId },
                {
                  id: 'departmentId',
                  label: 'Department',
                  sortable: true,
                  sortValue: (r) => r.departmentId ?? -1,
                  render: (r) => (r.departmentId != null ? (departmentNameById.get(r.departmentId) ?? `Department #${r.departmentId}`) : '-'),
                },
                {
                  id: 'categoryId',
                  label: 'Category',
                  sortable: true,
                  sortValue: (r) => r.categoryId ?? -1,
                  render: (r) => (r.categoryId != null ? (categoryNameById.get(r.categoryId) ?? `Category #${r.categoryId}`) : '-'),
                },
                { id: 'size', label: 'Size', sortable: true, sortValue: (r) => r.fileSize ?? 0, render: (r) => prettyBytes(r.fileSize) },
                {
                  id: 'actions',
                  label: 'Actions',
                  render: (r) => (
                    <div className="row-actions">
                      <Link className="action-link" to={`/documents/${r.id}`}>Open</Link>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditing(r)
                          setEditTitle(r.title)
                          setEditDescription(r.description ?? '')
                          setEditDepartmentId(r.departmentId ? String(r.departmentId) : '')
                          setEditCategoryId(r.categoryId ? String(r.categoryId) : '')
                        }}
                      >
                        Edit
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => setTargetDelete(r)}>Delete</Button>
                    </div>
                  ),
                },
              ]}
            />
          ) : null}
        </CardContent>
      </Card>

      <EntityDrawer open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload document" description="Upload a file and assign its metadata.">
        <form onSubmit={uploadDoc} className="grid two">
          <label className="grid gap-1 text-sm font-medium">Title<Input name="title" required /></label>
          <label className="grid gap-1 text-sm font-medium">Description<textarea name="description" rows={3} /></label>
          <label className="grid gap-1 text-sm font-medium">File<Input name="file" type="file" required /></label>
          <label className="grid gap-1 text-sm font-medium">Department<select name="departmentId" defaultValue=""><option value="">No department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Category<select name="categoryId" defaultValue=""><option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Button type="submit">Upload</Button>
        </form>
      </EntityDrawer>

      <EntityDrawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create document metadata" description="Create a document record before attaching or replacing a file.">
        <form onSubmit={createDoc} className="grid gap-3">
          <label className="grid gap-1 text-sm font-medium">Title<Input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} /></label>
          <label className="grid gap-1 text-sm font-medium">Department<select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">No department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Button type="submit">Create metadata</Button>
        </form>
      </EntityDrawer>

      <EntityDrawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit document metadata" description="Update title, department, and category.">
        <form onSubmit={saveEdit} className="grid gap-3">
          <div>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>← Back</Button>
          </div>
          <label className="grid gap-1 text-sm font-medium">Title<Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium">Description<textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} /></label>
          <label className="grid gap-1 text-sm font-medium">Department<select value={editDepartmentId} onChange={(e) => setEditDepartmentId(e.target.value)}><option value="">No department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Category<select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}><option value="">No category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Button type="submit">Save changes</Button>
        </form>
      </EntityDrawer>

      <ConfirmDialog open={Boolean(targetDelete)} title="Delete document" description={`Delete \"${targetDelete?.title}\"? This action cannot be undone.`} confirmText="Delete" onCancel={() => setTargetDelete(null)} onConfirm={deleteDoc} />
    </section>
  )
}
