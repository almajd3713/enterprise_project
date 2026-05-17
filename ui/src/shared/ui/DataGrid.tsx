import { useEffect, useMemo, useRef, useState } from 'react'

export type GridColumn<T> = {
  id: string
  label: string
  sortable?: boolean
  sortValue?: (row: T) => string | number | null | undefined
  render: (row: T) => React.ReactNode
}

type SortDirection = 'asc' | 'desc'

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined) {
  const av = a ?? ''
  const bv = b ?? ''
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
}

export function DataGrid<T>({
  title,
  rows,
  columns,
  empty,
  rowKey,
  initialPageSize = 10,
  initialSortBy,
  initialSortDirection = 'asc',
  initialPage = 1,
  onStateChange,
}: {
  title: string
  rows: T[]
  columns: GridColumn<T>[]
  empty: React.ReactNode
  rowKey: (row: T) => string | number
  initialPageSize?: number
  initialSortBy?: string | null
  initialSortDirection?: SortDirection
  initialPage?: number
  onStateChange?: (state: { sortBy: string | null; sortDirection: SortDirection; page: number; pageSize: number }) => void
}) {
  const [sortBy, setSortBy] = useState<string | null>(initialSortBy ?? null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection)
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [jumpPage, setJumpPage] = useState(String(initialPage))
  const onStateChangeRef = useRef(onStateChange)
  const lastEmittedRef = useRef('')

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.id === sortBy)
    if (!col || !col.sortable) return rows
    const getter = col.sortValue ?? ((row: T) => String(col.render(row)))
    return [...rows].sort((a, b) => {
      const cmp = compareValues(getter(a), getter(b))
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [rows, columns, sortBy, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const paged = sortedRows.slice(start, start + pageSize)

  useEffect(() => {
    onStateChangeRef.current = onStateChange
  }, [onStateChange])

  useEffect(() => {
    const payload = JSON.stringify({ sortBy, sortDirection, page: safePage, pageSize })
    if (payload === lastEmittedRef.current) return
    lastEmittedRef.current = payload
    onStateChangeRef.current?.({ sortBy, sortDirection, page: safePage, pageSize })
  }, [sortBy, sortDirection, safePage, pageSize])

  useEffect(() => {
    setJumpPage(String(safePage))
  }, [safePage])

  function toggleSort(colId: string) {
    if (sortBy === colId) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(colId)
      setSortDirection('asc')
    }
    setPage(1)
  }

  function pageWindow(current: number, total: number) {
    const min = Math.max(1, current - 1)
    const max = Math.min(total, min + 2)
    const out: number[] = []
    for (let i = min; i <= max; i += 1) out.push(i)
    return out
  }

  function goToPage(next: number) {
    const bounded = Math.min(totalPages, Math.max(1, next))
    setPage(bounded)
  }

  if (rows.length === 0) {
    return <>{empty}</>
  }

  return (
    <section className="stack-sm" aria-label={title}>
      <p className="sr-only" aria-live="polite">
        Sorted by {sortBy ?? 'none'} {sortDirection}. Page {safePage} of {totalPages}.
      </p>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sortBy === col.id
                const ariaSort = !col.sortable ? 'none' : active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
                return (
                  <th key={col.id} aria-sort={ariaSort}>
                    {col.sortable ? (
                      <button type="button" className="sort-btn" onClick={() => toggleSort(col.id)}>
                        {col.label}
                        <span aria-hidden="true">{active ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
                      </button>
                    ) : col.label}
                  </th>
                )}
              )}
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td key={col.id}>{col.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="pager" aria-label="Pagination controls">
        <div className="pager-meta">
          <span className="pager-count">
            {start + 1}-{Math.min(start + pageSize, sortedRows.length)} of {sortedRows.length}
          </span>
          <label>
            Page size
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <form
            className="pager-jump"
            onSubmit={(e) => {
              e.preventDefault()
              goToPage(Number(jumpPage))
            }}
          >
            <label>
              Go to
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value.replace(/[^\d]/g, ''))}
                aria-label="Go to page number"
              />
            </label>
            <button type="submit" className="btn-ghost">Go</button>
          </form>
        </div>
        <div className="pager-actions">
          <button type="button" className="btn-ghost" onClick={() => goToPage(1)} disabled={safePage === 1}>First</button>
          <button type="button" className="btn-ghost" onClick={() => goToPage(safePage - 1)} disabled={safePage === 1}>Prev</button>
          {safePage > 2 ? <span className="pager-ellipsis" aria-hidden="true">…</span> : null}
          {pageWindow(safePage, totalPages).map((p) => (
            <button key={p} type="button" className={p === safePage ? 'page-active' : 'btn-ghost'} onClick={() => goToPage(p)}>{p}</button>
          ))}
          {safePage < totalPages - 1 ? <span className="pager-ellipsis" aria-hidden="true">…</span> : null}
          <button type="button" className="btn-ghost" onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages}>Next</button>
          <button type="button" className="btn-ghost" onClick={() => goToPage(totalPages)} disabled={safePage === totalPages}>Last</button>
        </div>
        <span className="pager-page-label">Page {safePage} / {totalPages}</span>
      </footer>
    </section>
  )
}
