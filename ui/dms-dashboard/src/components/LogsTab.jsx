export default function LogsTab({
  logQuery,
  setLogQuery,
  queryLoki,
  logsLoading,
  logResult,
  loadTracesServices,
  tracesLoading,
  traceServices,
}) {
  return (
    <section className="panel-grid two">
      <article className="panel">
        <h2>Log Explorer (Loki)</h2>
        <label className="field">
          <span>LogQL Query</span>
          <textarea
            rows={3}
            value={logQuery}
            onChange={(e) => setLogQuery(e.target.value)}
          />
        </label>
        <div className="chip-row">
          <button
            className="chip action"
            type="button"
            onClick={() => setLogQuery('{service="documents"}')}
          >
            documents logs
          </button>
          <button
            className="chip action"
            type="button"
            onClick={() => setLogQuery('{service="documents"} |= "ERROR"')}
          >
            documents errors
          </button>
          <button
            className="chip action"
            type="button"
            onClick={() => setLogQuery('{service=~".+"}')}
          >
            all services
          </button>
        </div>
        <button className="btn top-gap" type="button" onClick={queryLoki}>
          {logsLoading ? 'Running Query...' : 'Run Log Query'}
        </button>

        <div className="log-result top-gap">
          {logResult.length === 0 ? (
            <p>No log lines loaded.</p>
          ) : (
            logResult.map((line, idx) => (
              <div className="log-line" key={`${line.ts}-${idx}`}>
                <small>{line.app} | {line.pod}</small>
                <p>{line.msg}</p>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="panel">
        <h2>Trace Explorer (Jaeger)</h2>
        <button className="btn" type="button" onClick={loadTracesServices}>
          {tracesLoading ? 'Loading Services...' : 'Load Jaeger Services'}
        </button>
        <ul className="status-list top-gap">
          {traceServices.length === 0 ? (
            <li>
              <span>No services loaded</span>
              <strong className="status unknown">idle</strong>
            </li>
          ) : (
            traceServices.map((service) => (
              <li key={service}>
                <span>{service}</span>
                <strong className="status online">available</strong>
              </li>
            ))
          )}
        </ul>
        <a
          className="inline-link top-gap"
          href="http://localhost:30686"
          target="_blank"
          rel="noreferrer"
        >
          Open Jaeger UI
        </a>
      </article>
    </section>
  )
}
