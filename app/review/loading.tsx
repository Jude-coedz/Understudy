export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-16 border-b border-border bg-background" />
      <div className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
        <div className="h-3 w-36 animate-pulse rounded-full bg-surface-3" />
        <div className="mt-4 h-9 w-3/4 animate-pulse rounded-xl bg-surface-3" />
        <div className="mt-8 h-80 animate-pulse rounded-2xl border border-border bg-card" />
        <p className="mt-5 text-center text-sm text-subtle">Opening successor verification…</p>
      </div>
    </div>
  );
}
