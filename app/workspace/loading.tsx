export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-16 border-b border-border bg-background" />
      <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="h-2 w-28 animate-pulse rounded-full bg-surface-3" />
          <div className="mt-8 h-9 w-2/3 animate-pulse rounded-xl bg-surface-3" />
          <div className="mt-4 h-5 w-1/2 animate-pulse rounded-lg bg-surface-3" />
          <div className="mt-8 h-64 animate-pulse rounded-2xl border border-border bg-card" />
          <p className="mt-5 text-center text-sm text-subtle">Opening this handoff…</p>
        </div>
      </div>
    </div>
  );
}
