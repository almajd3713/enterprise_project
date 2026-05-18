import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../shared/api/http'
import type { AdminConsoleResponse } from '../shared/types'
import { PageHeader } from '../shared/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'

function queryPath(services: string[], limit: number) {
  const params = new URLSearchParams()
  services.forEach((service) => params.append('services', service))
  params.set('limit', String(limit))
  return `/auth/admin/console?${params.toString()}`
}

export function AdminConsolePage() {
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [limit, setLimit] = useState(300)
  const [appliedServices, setAppliedServices] = useState<string[]>([])
  const [appliedLimit, setAppliedLimit] = useState(300)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
  const [refreshSeconds, setRefreshSeconds] = useState(5)
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all')

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['admin-console', appliedServices, appliedLimit],
    queryFn: () => apiGet<AdminConsoleResponse>(queryPath(appliedServices, appliedLimit)),
  })

  const available = data?.availableServices ?? []
  const effectiveSelected = useMemo(
    () => (selectedServices.length === 0 ? available : selectedServices),
    [selectedServices, available],
  )
  const filteredEntries = useMemo(() => {
    const entries = data?.entries ?? []
    if (levelFilter === 'all') return entries
    return entries.filter((entry) => entry.line.toLowerCase().includes(levelFilter))
  }, [data?.entries, levelFilter])

  function toggleService(service: string) {
    setSelectedServices((current) =>
      current.includes(service)
        ? current.filter((s) => s !== service)
        : [...current, service],
    )
  }

  function applyFilters() {
    setAppliedServices(selectedServices)
    setAppliedLimit(limit)
  }

  useEffect(() => {
    if (!autoRefreshEnabled) return
    const intervalMs = Math.max(2, refreshSeconds) * 1000
    const timer = window.setInterval(() => {
      void refetch()
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [autoRefreshEnabled, refreshSeconds, refetch])

  return (
    <section className="stack-lg">
      <PageHeader title="Admin Console" subtitle="Inspect aggregated live logs across one or many services." />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="stack-md">
          <p className="text-sm text-slate-500">Select none to include all services.</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
            {available.map((service) => (
              <label key={service} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedServices.includes(service)}
                  onChange={() => toggleService(service)}
                />
                <span>{service}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">
              Max lines
              <input
                type="number"
                min={50}
                max={2000}
                step={50}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value || 300))}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>
            <Button type="button" onClick={applyFilters}>Apply</Button>
            <Button type="button" variant="secondary" onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant={autoRefreshEnabled ? 'default' : 'secondary'} onClick={() => setAutoRefreshEnabled((v) => !v)}>
              {autoRefreshEnabled ? 'Pause auto-refresh' : 'Start auto-refresh'}
            </Button>
            <label className="text-sm">
              Every (sec)
              <input
                type="number"
                min={2}
                max={60}
                step={1}
                value={refreshSeconds}
                onChange={(e) => setRefreshSeconds(Number(e.target.value || 5))}
                style={{ marginLeft: 8, width: 72 }}
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Quick filter</span>
            <Button type="button" variant={levelFilter === 'all' ? 'default' : 'secondary'} onClick={() => setLevelFilter('all')}>All</Button>
            <Button type="button" variant={levelFilter === 'error' ? 'default' : 'secondary'} onClick={() => setLevelFilter('error')}>Error</Button>
            <Button type="button" variant={levelFilter === 'warn' ? 'default' : 'secondary'} onClick={() => setLevelFilter('warn')}>Warn</Button>
            <Button type="button" variant={levelFilter === 'info' ? 'default' : 'secondary'} onClick={() => setLevelFilter('info')}>Info</Button>
          </div>
          <p className="text-sm text-slate-500">
            Viewing: {effectiveSelected.length === 0 ? 'All services' : effectiveSelected.join(', ')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ maxHeight: 540, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--card)' }}>
            {filteredEntries.length === 0 ? (
              <p className="text-sm text-slate-500">{isFetching ? 'Loading logs...' : 'No logs found for current filter.'}</p>
            ) : (
              filteredEntries.map((entry, idx) => (
                <pre key={`${entry.service}-${entry.timestampNs}-${idx}`} style={{ margin: 0, padding: '4px 0', borderBottom: '1px dashed var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
                  [{entry.timestampIso || entry.timestampNs}] [{entry.service}] [{entry.stream || 'n/a'}] {entry.line}
                </pre>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
