export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-16 border-b border-border bg-background" />
      <div className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
        <div className="h-3 w-28 animate-pulse rounded-full bg-surface-3" />
        <div className="mt-4 h-9 w-2/3 animate-pulse rounded-xl bg-surface-3" />
        <div className="mt-8 grid gap-4 md:grid-cols-2"><div className="h-56 animate-pulse rounded-2xl border border-border bg-card" /><div className="h-56 animate-pulse rounded-2xl border border-border bg-card" /></div>
        <p className="mt-5 text-center text-sm text-subtle">Opening the handoff record…</p>
      </div>
    </div>
  );
}
