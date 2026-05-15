export default function OperationsTab({
  operationsBusy,
  runOperation,
  loadDocuments,
  loadCommentsForDoc,
  commentDocId,
  runDiagnostics,
  handleWarmupFlow,
  setError,
  setToast,
  operationHistory,
}) {
  return (
    <section className="panel-grid two">
      <article className="panel">
        <h2>Job Center</h2>
        <div className="op-grid">
          <button
            className="btn"
            type="button"
            onClick={() => runOperation('Refresh Documents', loadDocuments)}
            disabled={operationsBusy}
          >
            Refresh Documents
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => runOperation('Refresh Comments', () => loadCommentsForDoc(commentDocId))}
            disabled={operationsBusy}
          >
            Refresh Comments
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => runOperation('Run Diagnostics', runDiagnostics)}
            disabled={operationsBusy}
          >
            Run Diagnostics
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => runOperation('Warm Full Flow', handleWarmupFlow)}
            disabled={operationsBusy}
          >
            Warm Full Document Flow
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() =>
              runOperation('Clear Local Alerts', async () => {
                setError('')
                setToast('')
                return 'Local alert buffers cleared'
              })
            }
            disabled={operationsBusy}
          >
            Clear Alerts
          </button>
        </div>
        <p className="small-note">{operationsBusy ? 'Operation running...' : 'Ready for operation.'}</p>
      </article>

      <article className="panel">
        <h2>Execution Log</h2>
        <div className="operation-log">
          {operationHistory.length === 0 ? (
            <p>No operations executed yet.</p>
          ) : (
            operationHistory.map((item) => (
              <div key={item.id} className="operation-item">
                <p>
                  <strong>{item.name}</strong>
                  <span className={`op-status ${item.status}`}>{item.status}</span>
                </p>
                <p>{item.details}</p>
                <small>{item.at}</small>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  )
}
