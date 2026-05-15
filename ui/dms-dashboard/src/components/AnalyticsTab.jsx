export default function AnalyticsTab({ analytics }) {
  return (
    <section className="panel-grid two">
      <article className="panel">
        <h2>Core KPI</h2>
        <div className="kpi-list">
          <p>Total Requests: <strong>{analytics.totalReq}</strong></p>
          <p>Success Rate: <strong>{analytics.successRate}%</strong></p>
          <p>Average Latency: <strong>{analytics.avgLatency} ms</strong></p>
          <p>p95 Latency: <strong>{analytics.p95} ms</strong></p>
        </div>
      </article>
      <article className="panel">
        <h2>Weekly Activity Trend</h2>
        <div className="trend-grid">
          {analytics.points.map((point) => (
            <div className="trend-col" key={point.day}>
              <div className="bar-stack">
                <span
                  className="bar docs"
                  style={{ height: `${Math.max(8, point.docsValue * 2)}px` }}
                  title={`Docs: ${point.docsValue}`}
                />
                <span
                  className="bar comments"
                  style={{ height: `${Math.max(8, point.commentsValue * 2)}px` }}
                  title={`Comments: ${point.commentsValue}`}
                />
              </div>
              <small>{point.day}</small>
            </div>
          ))}
        </div>
        <p className="legend">
          <span className="dot docs" /> Documents
          <span className="dot comments" /> Comments
        </p>
      </article>
    </section>
  )
}
