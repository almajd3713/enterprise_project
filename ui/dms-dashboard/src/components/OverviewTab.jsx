export default function OverviewTab({ documents, comments, environment, role, range, health, healthLoading, runDiagnostics }) {
  const gatewayStatus = health.gateway?.status || 'unknown'
  const fullflowStatus = health.fullflow?.status || 'unknown'
  return (
    <section className="panel-grid three">
      <article className="panel">
        <h2>Documents Indexed</h2>
        <p className="metric">{documents.length}</p>
        <p>Total document records available from documents service.</p>
      </article>
      <article className="panel">
        <h2>Comments Loaded</h2>
        <p className="metric">{comments.length}</p>
        <p>Comments currently loaded for the active document context.</p>
      </article>
      <article className="panel">
        <h2>Session Context</h2>
        <p className="metric small">{environment}</p>
        <p>Role: {role} | Time range: {range}</p>
      </article>
      <article className="panel">
        <h2>Gateway Health</h2>
        <p className={`status ${gatewayStatus}`}>
          {gatewayStatus}
        </p>
        <p>
          Latency: {health.gateway?.latencyMs ?? '-'} ms | HTTP {health.gateway?.code ?? '-'}
        </p>
      </article>
      <article className="panel">
        <h2>Service Chain</h2>
        <p className={`status ${fullflowStatus}`}>
          {fullflowStatus}
        </p>
        <p>End-to-end `documents/full` path via gateway + comments.</p>
      </article>
      <article className="panel">
        <h2>Quick Actions</h2>
        <p>Last update: {health.updatedAt || '-'}</p>
        <button className="btn secondary" type="button" onClick={runDiagnostics}>
          {healthLoading ? 'Running checks...' : 'Run Health Checks'}
        </button>
      </article>
    </section>
  )
}
