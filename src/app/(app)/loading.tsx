export default function LoadingClients() {
  return (
    <section className="stack large-gap" aria-busy="true" aria-label="Loading clients">
      <div className="skeleton heading-skeleton" />
      <div className="client-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton card-skeleton" key={index} />
        ))}
      </div>
    </section>
  );
}
