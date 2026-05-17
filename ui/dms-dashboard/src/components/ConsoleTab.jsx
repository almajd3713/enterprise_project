import React, { useEffect, useRef } from 'react'

export default function ConsoleTab({
  logs,
  filter,
  setFilter,
  clearLogs,
  refreshLogs,
  loading,
  lastUpdatedAt,
}) {
  const scrollRef = useRef(null)

  const services = [
    'all',
    'gateway',
    'documents',
    'comments',
    'translator-service',
    'kafka',
    'postgres',
    'redis',
    'minio',
    'zookeeper',
    'kafka-ui'
  ]

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(l => l.service === filter)

  return (
    <section className="panel-grid one">
      <article className="panel console-panel">
        <div className="panel-head">
          <h2>System Console</h2>
          <div className="toolbar-row">
            <span className="small-note">
              {loading ? 'Syncing from Loki...' : lastUpdatedAt ? `Last synced ${lastUpdatedAt}` : 'Ready'}
            </span>
            <label className="field inline compact">
              <span>Service Filter</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                {services.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className="btn ghost compact" onClick={refreshLogs} type="button">Refresh</button>
            <button className="btn ghost compact" type="button" onClick={clearLogs}>Clear Console</button>
          </div>
        </div>

        <div className="console-output" ref={scrollRef}>
          {filteredLogs.length === 0 ? (
            <div className="console-empty">
              <span className="blink">_</span> No active log streams. Select a service or wait for events.
            </div>
          ) : (
            filteredLogs.map((log, idx) => (
              <div key={idx} className={`console-line ${log.level?.toLowerCase() || 'info'}`}>
                <span className="console-ts">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="console-svc">{log.service}</span>
                <span className="console-level">{log.level}</span>
                <span className="console-msg">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}
