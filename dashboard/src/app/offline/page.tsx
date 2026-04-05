export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6 text-[#1a1a2e]">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold text-gray-400">Offline</div>
        <h1 className="mt-3 text-2xl font-semibold">You're offline</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Team Dashboard is cached. Tasks, nodes, and live messages will resume syncing when your connection is restored.
        </p>
      </div>
    </main>
  )
}