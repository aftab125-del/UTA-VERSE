interface CatalogStateProps {
  title: string;
  message: string;
  tone?: "empty" | "error" | "loading";
}

export function CatalogState({ title, message, tone = "empty" }: CatalogStateProps) {
  return (
    <div className={`empty-panel catalog-state catalog-state--${tone}`} role={tone === "error" ? "alert" : undefined}>
      <span className="empty-panel__mark" aria-hidden="true">{tone === "error" ? "!" : tone === "loading" ? "…" : "·"}</span>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}
