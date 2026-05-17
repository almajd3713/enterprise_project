export default function GatewayTab({ analytics, health, runDiagnostics }) {
  return (
    <section className="panel-grid two">
      <article className="panel">
        <h2>Gateway Control</h2>
        <div className="kpi-list">
          <p>Recent Requests: <strong>{analytics.totalReq}</strong></p>
          <p>Failed Requests: <strong>{analytics.failed}</strong></p>
          <p>Success Rate: <strong>{analytics.successRate}%</strong></p>
        </div>
        <button className="btn secondary" type="button" onClick={runDiagnostics}>
          Run Gateway Diagnostics
        </button>
      </article>
      <article className="panel">
        <h2>Route Diagnostics</h2>
        <ul className="status-list">
          <li>
            <span>Documents Route</span>
            <strong className={`status ${health.documents?.status || 'unknown'}`}>
              {health.documents?.status || 'unknown'}
            </strong>
          </li>
          <li>
            <span>Comments Route</span>
            <strong className={`status ${health.comments?.status || 'unknown'}`}>
              {health.comments?.status || 'unknown'}
            </strong>
          </li>
          <li>
            <span>Full Flow Route</span>
            <strong className={`status ${health.fullflow?.status || 'unknown'}`}>
              {health.fullflow?.status || 'unknown'}
            </strong>
          </li>
          <li>
            <span>Gateway Route</span>
            <strong className={`status ${health.gateway?.status || 'unknown'}`}>
              {health.gateway?.status || 'unknown'}
            </strong>
          </li>
        </ul>
      </article>
    </section>
  )
}
