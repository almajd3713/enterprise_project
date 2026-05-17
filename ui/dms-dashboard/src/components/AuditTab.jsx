export default function AuditTab({ auditEvents, auditIntegrity, exportAuditLog, loadAuditData }) {
  return (
    <section className="panel-grid two">
      <article className="panel">
        <h2>Integrity Summary</h2>
        <div className="kpi-list">
          <p>Chain Valid: <strong>{auditIntegrity?.chainValid ? 'Yes' : 'No'}</strong></p>
          <p>Total Events: <strong>{auditIntegrity?.totalEvents ?? '-'}</strong></p>
          <p>Invalid Events: <strong>{auditIntegrity?.invalidEvents ?? '-'}</strong></p>
        </div>
        <div className="toolbar-row top-gap">
          <button className="btn" type="button" onClick={loadAuditData}>
            Refresh
          </button>
          <button className="btn secondary" type="button" onClick={exportAuditLog}>
            Export JSON
          </button>
        </div>
        <p className="small-note top-gap">Integrity payload</p>
        <pre>{JSON.stringify(auditIntegrity, null, 2)}</pre>
      </article>

      <article className="panel">
        <h2>Audit Timeline</h2>
        <div className="operation-log">
          {auditEvents.length === 0 ? (
            <p>No audit events captured yet. Perform operations to generate entries.</p>
          ) : (
            auditEvents.map((entry) => (
              <div key={entry.id || entry.eventId} className="operation-item">
                <p>
                  <strong>{entry.action}</strong> on <strong>{entry.resourceType}</strong>
                </p>
                <p>resourceId={entry.resourceId || '-'}</p>
                <small>{entry.occurredAt} | actor: {entry.actor}</small>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}
