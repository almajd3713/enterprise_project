export default function OverviewTab({ documents, comments, environment, role, range, health, healthLoading, runDiagnostics }) {
  return (
    <section className="panel-grid three">
      <article className="panel">
        <h2>Documents</h2>
        <p className="metric">{documents.length}</p>
        <p>Available document records from Documents service</p>
      </article>
      <article className="panel">
        <h2>Comments</h2>
        <p className="metric">{comments.length}</p>
        <p>Latest comments loaded for selected document</p>
      </article>
      <article className="panel">
        <h2>Environment</h2>
        <p className="metric small">{environment}</p>
        <p>Role: {role} | Time range: {range}</p>
      </article>
      <article className="panel">
        <h2>Gateway Health</h2>
        <p className={`status ${health.gateway?.status || 'unknown'}`}>
          {health.gateway?.status || 'unknown'}
        </p>
        <p>
          Latency: {health.gateway?.latencyMs ?? '-'} ms | HTTP {health.gateway?.code ?? '-'}
        </p>
      </article>
      <article className="panel">
        <h2>Service Chain</h2>
        <p className={`status ${health.fullflow?.status || 'unknown'}`}>
          {health.fullflow?.status || 'unknown'}
        </p>
        <p>documents/full flow check via gateway and comments integration</p>
      </article>
      <article className="panel">
        <h2>Diagnostics</h2>
        <p>Last update: {health.updatedAt || '-'}</p>
        <button className="btn secondary" type="button" onClick={runDiagnostics}>
          {healthLoading ? 'Running checks...' : 'Run Health Checks'}
        </button>
      </article>
    </section>
  )
}
