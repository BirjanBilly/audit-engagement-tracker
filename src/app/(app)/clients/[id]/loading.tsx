export default function LoadingClient() {
  return (
    <section className="stack large-gap" aria-busy="true" aria-label="Loading client">
      <div className="skeleton heading-skeleton" />
      <div className="skeleton panel-skeleton" />
      <div className="skeleton panel-skeleton" />
    </section>
  );
}
