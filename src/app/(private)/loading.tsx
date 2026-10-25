export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <p className="text-sm text-muted-foreground">Cargando información…</p>
      <div className="h-12 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
