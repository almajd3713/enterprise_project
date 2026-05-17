export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="empty-state" role="status">
      <h3>{title}</h3>
      <p>{body}</p>
    </section>
  )
}
