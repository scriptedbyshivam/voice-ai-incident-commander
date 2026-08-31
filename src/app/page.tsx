'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sun,
  Moon,
  Radio,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  Clock
} from 'lucide-react';

export default function Home() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 relative overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
    >
      {/* Background glow & ambient effects */}
      <div
        className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-400/20'
          }`}
      />
      <div
        className={`absolute bottom-10 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${isDark ? 'bg-emerald-500/5' : 'bg-emerald-300/20'
          }`}
      />
      <div
        className={`absolute top-1/3 right-10 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${isDark ? 'bg-purple-500/5' : 'bg-purple-300/15'
          }`}
      />

      {/* Header */}
      <header
        className={`border-b backdrop-blur-md sticky top-0 z-50 transition-colors duration-300 ${isDark
          ? 'border-slate-800/80 bg-slate-950/70'
          : 'border-slate-200/80 bg-white/75 shadow-sm'
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
              <Zap className="w-4 h-4 fill-white text-white" />
            </div>
            <span
              className={`font-bold text-xl tracking-tight bg-clip-text text-transparent ${isDark
                ? 'bg-gradient-to-r from-white via-slate-100 to-slate-300'
                : 'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950'
                }`}
            >
              AI Incident Commander
            </span>
            <span
              className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border transition-colors ${isDark
                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}
            >
              MVP
            </span>
          </div>

          {/* Navigation & Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/incidents"
              className={`text-sm font-medium transition-colors ${isDark
                ? 'text-slate-300 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Dashboard
            </Link>

            <Link
              href="/incidents/new"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all"
            >
              New Incident
            </Link>

            {/* Subtle vertical divider */}
            <div
              className={`h-5 w-[1px] transition-colors ${
                isDark ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            />

            {/* Theme Toggle Button (Top-Right Corner) */}
            {mounted && (
              <button
                onClick={toggleTheme}
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
                title={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}
                className={`relative w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all duration-300 active:scale-90 hover:scale-105 ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-800 text-amber-400 hover:bg-slate-800 hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/10'
                    : 'bg-white border-slate-200 text-indigo-600 hover:bg-slate-50 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/10'
                }`}
              >
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <Sun
                    className={`w-4 h-4 absolute transition-all duration-500 ease-in-out transform ${
                      isDark
                        ? 'rotate-0 scale-100 opacity-100 text-amber-400'
                        : '-rotate-90 scale-0 opacity-0 text-amber-500'
                    }`}
                  />
                  <Moon
                    className={`w-4 h-4 absolute transition-all duration-500 ease-in-out transform ${
                      isDark
                        ? 'rotate-90 scale-0 opacity-0 text-indigo-400'
                        : 'rotate-0 scale-100 opacity-100 text-indigo-600'
                    }`}
                  />
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-14 sm:py-20 flex flex-col justify-center relative">
        <div className="max-w-3xl space-y-6">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${isDark
              ? 'bg-slate-900/90 border-slate-800 text-indigo-400'
              : 'bg-indigo-50 border-indigo-200/80 text-indigo-700 shadow-xs'
              }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Driven Real-time Incident Intelligence Bridge</span>
          </div>

          <h1
            className={`text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.15] transition-colors ${isDark ? 'text-white' : 'text-slate-900'
              }`}
          >
            Maintain control during{' '}
            <span
              className={`bg-clip-text text-transparent ${isDark
                ? 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'
                }`}
            >
              high-severity outages
            </span>
          </h1>

          <p
            className={`text-base sm:text-lg leading-relaxed max-w-2xl transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'
              }`}
          >
            AI Incident Commander monitors your voice bridge, analyzes live discussions, maps out confirmed facts and hypotheses, flags operational conflicts, and coordinates critical action items with human confirmation.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/incidents"
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all flex items-center gap-2 group"
            >
              Enter Commander Console
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/incidents/new"
              className={`px-6 py-3 rounded-lg font-semibold border transition-all ${isDark
                ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm'
                }`}
            >
              Declare Incident
            </Link>
          </div>
        </div>

        {/* Live Metrics / Capabilities Bar */}
        <div
          className={`mt-16 p-5 rounded-2xl border backdrop-blur-md grid grid-cols-2 md:grid-cols-4 gap-4 transition-all ${isDark
            ? 'bg-slate-900/40 border-slate-800/80 text-slate-300'
            : 'bg-white/70 border-slate-200/80 text-slate-700 shadow-sm'
            }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Agora RTC
              </div>
              <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Voice Channels
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Streaming STT
              </div>
              <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Deepgram Live
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Reasoning
              </div>
              <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Conflict Detection
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Human-in-Loop
              </div>
              <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Safety Protected
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div
            className={`p-6 rounded-2xl border transition-all duration-300 backdrop-blur-sm space-y-3.5 group ${isDark
              ? 'bg-slate-900/60 border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/90 shadow-xl'
              : 'bg-white/80 border-slate-200/90 hover:border-indigo-300 hover:bg-white shadow-md shadow-slate-200/50 hover:shadow-xl'
              }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${isDark
                ? 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20'
                : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 group-hover:bg-indigo-100'
                }`}
            >
              <Radio className="w-5 h-5" />
            </div>
            <h3 className={`text-lg font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Live Voice Bridge Analysis
            </h3>
            <p className={`text-sm leading-relaxed transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Connect to your Agora RTC incident voice channel. Our system monitors human discussions in real time using Deepgram streaming speech-to-text.
            </p>
          </div>

          <div
            className={`p-6 rounded-2xl border transition-all duration-300 backdrop-blur-sm space-y-3.5 group ${isDark
              ? 'bg-slate-900/60 border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-900/90 shadow-xl'
              : 'bg-white/80 border-slate-200/90 hover:border-emerald-300 hover:bg-white shadow-md shadow-slate-200/50 hover:shadow-xl'
              }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${isDark
                ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20'
                : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 group-hover:bg-emerald-100'
                }`}
            >
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className={`text-lg font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Structured Intelligence State
            </h3>
            <p className={`text-sm leading-relaxed transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Maintains full situational awareness by extracting confirmed facts, observations, hypotheses, conflicts, and decisions, along with their evidence trails.
            </p>
          </div>

          <div
            className={`p-6 rounded-2xl border transition-all duration-300 backdrop-blur-sm space-y-3.5 group ${isDark
              ? 'bg-slate-900/60 border-slate-800/80 hover:border-rose-500/50 hover:bg-slate-900/90 shadow-xl'
              : 'bg-white/80 border-slate-200/90 hover:border-rose-300 hover:bg-white shadow-md shadow-slate-200/50 hover:shadow-xl'
              }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${isDark
                ? 'bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20'
                : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100 group-hover:bg-rose-100'
                }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className={`text-lg font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Safety & Human in the Loop
            </h3>
            <p className={`text-sm leading-relaxed transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              AI is blocked from declaring root causes independently or executing operational actions without explicit human approval. Keep full command authority.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className={`border-t py-8 text-center text-xs transition-colors duration-300 ${isDark
          ? 'border-slate-900 bg-slate-950 text-slate-500'
          : 'border-slate-200 bg-slate-100/75 text-slate-500'
          }`}
      >
        <p>© 2026 AI Incident Commander. Designed for secure high-availability operations.</p>
      </footer>
    </div>
  );
}
