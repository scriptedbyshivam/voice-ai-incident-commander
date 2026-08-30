import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-500/20">
              ⚡
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
              AI Incident Commander
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
              MVP
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/incidents"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/incidents/new"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
            >
              New Incident
            </Link>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 flex flex-col justify-center relative">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            AI-Driven Real-time Incident Intelligence Bridge
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            maintain control during{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500">
              high-severity outages
            </span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl">
            AI Incident Commander monitors your voice bridge, analyzes live discussions, maps out confirmed facts and hypotheses, flags operational conflicts, and coordinates critical action items with human confirmation.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link
              href="/incidents"
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 group"
            >
              Enter Commander Console
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="/incidents/new"
              className="px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold transition-all"
            >
              Declare Incident
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-xl backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xl font-bold">
              🔊
            </div>
            <h3 className="text-lg font-bold text-white">Live Voice Bridge Analysis</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Connect to your Agora RTC incident voice channel. Our system monitors human discussions in real time using Deepgram streaming speech-to-text.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-xl backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl font-bold">
              📊
            </div>
            <h3 className="text-lg font-bold text-white">Structured Intelligence State</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Maintains full situational awareness by extracting confirmed facts, observations, hypotheses, conflicts, and decisions, along with their evidence trails.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-xl backdrop-blur-sm space-y-3">
            <div className="w-10 h-10 rounded bg-rose-500/10 text-rose-400 flex items-center justify-center text-xl font-bold">
              🛡️
            </div>
            <h3 className="text-lg font-bold text-white">Safety & Human in the Loop</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              AI is blocked from declaring root causes independently or executing operational actions without explicit human approval. Keep full command authority.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-slate-600 text-xs">
        <p>© 2026 AI Incident Commander. Designed for secure high-availability operations.</p>
      </footer>
    </div>
  );
}
