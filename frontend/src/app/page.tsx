export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          <span className="text-accent-cyan">Game</span>
          <span className="text-accent-purple">Forge</span>
        </h1>
        <p className="max-w-md text-lg text-muted">
          Describe a game, play it in seconds.
        </p>
        <div className="mt-4 rounded-2xl border border-card-border bg-card px-8 py-4">
          <p className="font-mono text-sm text-muted">
            AI-powered game generation coming soon
          </p>
        </div>
      </div>
    </main>
  );
}
