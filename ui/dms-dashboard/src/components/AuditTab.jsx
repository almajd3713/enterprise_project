export default function AuditTab({ auditLog, setAuditLog, exportAuditLog }) {
  return (
    <section className="panel-grid one">
      <article className="panel">
        <h2>Audit Timeline</h2>
        <div className="toolbar-row top-gap">
          <button className="btn secondary" type="button" onClick={exportAuditLog}>
            Export JSON
          </button>
          <button className="btn ghost" type="button" onClick={() => setAuditLog([])}>
            Clear Timeline
          </button>
        </div>
        <div className="operation-log">
          {auditLog.length === 0 ? (
            <p>No audit events captured yet. Perform operations to generate entries.</p>
          ) : (
            auditLog.map((entry) => (
              <div key={entry.id} className="operation-item">
                <p>
                  <strong>{entry.action}</strong> on <strong>{entry.resource}</strong>
                </p>
                <p>{entry.details}</p>
                <small>{entry.at} | actor: {entry.actor}</small>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}
