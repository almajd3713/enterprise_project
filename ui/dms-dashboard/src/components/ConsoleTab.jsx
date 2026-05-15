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
                {services.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className="btn ghost compact" onClick={refreshLogs} type="button">Refresh</button>
            <button className="btn ghost compact" onClick={clearLogs}>Clear Console</button>
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

      <style jsx="true">{`
        .console-panel {
          background: #1e1e1e;
          color: #d4d4d4;
          border: 1px solid #333;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 250px);
          min-height: 500px;
        }
        .console-panel h2 {
          color: #fff;
        }
        .console-output {
          flex: 1;
          background: #000;
          font-family: 'Fira Code', 'Courier New', monospace;
          font-size: 0.9rem;
          padding: 1rem;
          overflow-y: auto;
          border-radius: 4px;
          box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
        }
        .console-line {
          margin-bottom: 4px;
          white-space: pre-wrap;
          line-height: 1.4;
          border-left: 3px solid transparent;
          padding-left: 8px;
        }
        .console-line.error { border-left-color: #f44336; color: #ff8a80; }
        .console-line.warn { border-left-color: #ff9800; color: #ffd180; }
        .console-line.info { border-left-color: #2196f3; color: #80d8ff; }
        .console-line.debug { border-left-color: #9e9e9e; color: #e0e0e0; }

        .console-ts { color: #888; margin-right: 8px; }
        .console-svc { color: #4caf50; font-weight: bold; margin-right: 8px; min-width: 140px; display: inline-block; }
        .console-level { color: #aaa; margin-right: 12px; font-weight: bold; width: 60px; display: inline-block; }
        
        .console-empty {
          color: #666;
          text-align: center;
          margin-top: 2rem;
        }
        .blink {
          animation: blink-animation 1s steps(5, start) infinite;
        }
        @keyframes blink-animation {
          to { visibility: hidden; }
        }
      `}</style>
    </section>
  )
}
