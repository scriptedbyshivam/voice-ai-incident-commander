'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
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
  Clock,
  Volume2,
  AlertTriangle,
  Check
} from 'lucide-react';

export default function Home() {
  const { theme, isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Scroll-Driven Animations using useScroll & useTransform (as per motion.dev docs)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Hero section blurs and scales as user scrolls down
  const heroFilter = useTransform(scrollYProgress, [0, 0.35], ['blur(0px)', 'blur(10px)']);
  const heroScale = useTransform(scrollYProgress, [0, 0.35], [1, 0.92]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0.2]);
  const heroY = useTransform(scrollYProgress, [0, 0.35], [0, 50]);

  // Command console zooms in and comes into sharp focus on scroll
  const consoleScale = useTransform(scrollYProgress, [0.02, 0.35], [0.88, 1]);
  const consoleFilter = useTransform(scrollYProgress, [0.02, 0.25], ['blur(8px)', 'blur(0px)']);
  const consoleOpacity = useTransform(scrollYProgress, [0.02, 0.25], [0.5, 1]);
  const consoleRotateX = useTransform(scrollYProgress, [0.02, 0.35], [12, 0]);

  // Ambient glow diffusion on scroll
  const glowScale = useTransform(scrollYProgress, [0, 0.6], [1, 1.4]);
  const glowFilter = useTransform(scrollYProgress, [0, 0.6], ['blur(60px)', 'blur(100px)']);

  return (
    <div
      ref={containerRef}
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 relative overflow-x-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Scroll Progress Bar at the Top */}
      <motion.div
        style={{ scaleX: scrollYProgress }}
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 origin-left z-50 pointer-events-none"
      />

      {/* Floating Animated Background Orbs */}
      <motion.div
        animate={{ y: [0, -20, 0], scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
        style={{ scale: glowScale, filter: glowFilter }}
        className={`absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none transition-colors duration-500 ${
          isDark ? 'bg-indigo-500/15' : 'bg-indigo-400/25'
        }`}
      />
      <motion.div
        animate={{ y: [0, 20, 0], scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
        style={{ scale: glowScale }}
        className={`absolute top-1/2 right-1/4 w-[30rem] h-[30rem] rounded-full pointer-events-none blur-3xl transition-colors duration-500 ${
          isDark ? 'bg-emerald-500/10' : 'bg-emerald-300/20'
        }`}
      />
      <div
        className={`absolute top-1/3 right-10 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          isDark ? 'bg-purple-500/10' : 'bg-purple-300/15'
        }`}
      />

      {/* Header */}
      <header
        className={`border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-300 ${
          isDark
            ? 'border-slate-800/80 bg-slate-950/75'
            : 'border-slate-200/80 bg-white/75 shadow-xs'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
              <Zap className="w-4 h-4 fill-white text-white" />
            </div>
            <span
              className={`font-bold text-xl tracking-tight bg-clip-text text-transparent ${
                isDark
                  ? 'bg-gradient-to-r from-white via-slate-100 to-slate-300'
                  : 'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950'
              }`}
            >
              AI Incident Commander
            </span>
            <span
              className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border transition-colors ${
                isDark
                  ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}
            >
              MVP
            </span>
          </motion.div>

          {/* Navigation & Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 sm:gap-4"
          >
            <Link
              href="/incidents"
              className={`text-sm font-medium transition-colors ${
                isDark
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

            {/* Theme Toggle Button with Motion Layout Animation */}
            <ThemeToggle />
          </motion.div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 sm:py-16 flex flex-col justify-center relative">
        {/* Animated Hero Section with Entry & Scroll-Driven Transforms */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            scale: heroScale,
            opacity: heroOpacity,
            filter: heroFilter,
            y: heroY,
          }}
          className="max-w-3xl space-y-6"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
              isDark
                ? 'bg-slate-900/90 border-slate-800 text-indigo-400'
                : 'bg-indigo-50 border-indigo-200/80 text-indigo-700 shadow-xs'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Driven Real-time Incident Intelligence Bridge</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className={`text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.15] transition-colors ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Maintain control during{' '}
            <span
              className={`bg-clip-text text-transparent ${
                isDark
                  ? 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'
              }`}
            >
              high-severity outages
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className={`text-base sm:text-lg leading-relaxed max-w-2xl transition-colors ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            AI Incident Commander monitors your voice bridge, analyzes live discussions, maps out confirmed facts and hypotheses, flags operational conflicts, and coordinates critical action items with human confirmation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-wrap items-center gap-4 pt-2"
          >
            <Link
              href="/incidents"
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all flex items-center gap-2 group cursor-pointer"
            >
              Enter Commander Console
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/incidents/new"
              className={`px-6 py-3 rounded-lg font-semibold border transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm'
              }`}
            >
              Declare Incident
            </Link>
          </motion.div>
        </motion.div>

        {/* 2. Scroll-Zoom Hero Console Preview (using motion useTransform) */}
        <motion.div
          style={{
            scale: consoleScale,
            opacity: consoleOpacity,
            filter: consoleFilter,
            rotateX: consoleRotateX,
            transformPerspective: 1000,
          }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-14 w-full"
        >
          <div
            className={`rounded-2xl border p-1 shadow-2xl transition-all duration-300 ${
              isDark
                ? 'bg-slate-900/80 border-slate-800/90 shadow-indigo-950/40'
                : 'bg-white/90 border-slate-200/90 shadow-slate-300/50'
            }`}
          >
            {/* Console Mockup Bar */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between text-xs font-mono rounded-t-xl ${
                isDark
                  ? 'border-slate-800 bg-slate-950/60 text-slate-400'
                  : 'border-slate-100 bg-slate-50 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="ml-2 font-semibold">INCIDENT #9481 // LIVE VOICE BRIDGE</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  AGORA CHANNEL ACTIVE
                </span>
                <span className="hidden sm:inline opacity-60">| 4 SREs CONNECTED</span>
              </div>
            </div>

            {/* Interactive Console Content */}
            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Live Audio Transcript Stream */}
              <div
                className={`p-4 rounded-xl border font-mono text-xs space-y-3 ${
                  isDark ? 'bg-slate-950/70 border-slate-800/70' : 'bg-slate-50 border-slate-200/70'
                }`}
              >
                <div className="flex items-center justify-between font-semibold pb-2 border-b border-inherit">
                  <span className="flex items-center gap-1.5 text-indigo-400">
                    <Volume2 className="w-4 h-4 animate-pulse" /> Live Voice Transcription
                  </span>
                  <span className="text-[10px] uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Deepgram STT
                  </span>
                </div>
                <div className="space-y-2.5">
                  <p className="leading-relaxed">
                    <span className="text-indigo-400 font-bold">[Sarah - Lead SRE]:</span> &quot;We see a 40% spike in 504 Gateway Timeouts across US-East-1 auth clusters.&quot;
                  </p>
                  <p className="leading-relaxed">
                    <span className="text-emerald-400 font-bold">[Dave - DBA]:</span> &quot;Postgres connection pool maxed out at 500 connections after the 23:15 deployment.&quot;
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                    <span>Listening to live speech stream...</span>
                  </div>
                </div>
              </div>

              {/* AI Structured Intelligence State */}
              <div
                className={`p-4 rounded-xl border text-xs space-y-3 ${
                  isDark ? 'bg-slate-950/70 border-slate-800/70' : 'bg-slate-50 border-slate-200/70'
                }`}
              >
                <div className="flex items-center justify-between font-semibold pb-2 border-b border-inherit">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <BarChart3 className="w-4 h-4" /> Real-Time Intelligence
                  </span>
                  <span className="text-[10px] text-indigo-400 font-mono">2 Conflicts Found</span>
                </div>
                <div className="space-y-2">
                  <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-indigo-950/30 border-indigo-800/50' : 'bg-indigo-50/70 border-indigo-200'}`}>
                    <div className="font-semibold text-indigo-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Confirmed Fact
                    </div>
                    <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Database connection pool exhaustion at 23:15 UTC.
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-rose-950/30 border-rose-800/50' : 'bg-rose-50/70 border-rose-200'}`}>
                    <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Hypothesis Conflict
                    </div>
                    <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      Cache latency vs RDS CPU contention conflicting evidence.
                    </p>
                  </div>
                </div>
              </div>

              {/* Human in the Loop Action Execution Queue */}
              <div
                className={`p-4 rounded-xl border text-xs space-y-3 ${
                  isDark ? 'bg-slate-950/70 border-slate-800/70' : 'bg-slate-50 border-slate-200/70'
                }`}
              >
                <div className="flex items-center justify-between font-semibold pb-2 border-b border-inherit">
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <ShieldCheck className="w-4 h-4" /> Action Approval Queue
                  </span>
                  <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-mono">
                    Requires Human Sign-off
                  </span>
                </div>
                <div className="space-y-2">
                  <div className={`p-3 rounded-lg border flex items-center justify-between ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div>
                      <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Rollback Auth Deployment #v3.8.2
                      </div>
                      <div className="text-[10px] text-slate-500">Proposed by Commander AI</div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] font-semibold cursor-pointer">
                      Approve
                    </span>
                  </div>
                  <div className={`p-3 rounded-lg border flex items-center justify-between opacity-75 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    <div>
                      <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Increase RDS Max Connections to 1000
                      </div>
                      <div className="text-[10px] text-slate-500">Pending secondary review</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[11px] font-semibold border ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
                      Review
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Live Metrics / Capabilities Bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={`mt-16 p-5 rounded-2xl border backdrop-blur-md grid grid-cols-2 md:grid-cols-4 gap-4 transition-all ${
            isDark
              ? 'bg-slate-900/40 border-slate-800/80 text-slate-300'
              : 'bg-white/70 border-slate-200/80 text-slate-700 shadow-xs'
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
        </motion.div>

        {/* Feature Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`p-6 rounded-2xl border transition-all duration-300 backdrop-blur-sm space-y-3.5 group cursor-pointer ${
              isDark
                ? 'bg-slate-900/60 border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/90 shadow-xl'
                : 'bg-white/80 border-slate-200/90 hover:border-indigo-300 hover:bg-white shadow-md shadow-slate-200/50 hover:shadow-xl'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                isDark
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`p-6 rounded-2xl border transition-all duration-300 backdrop-blur-sm space-y-3.5 group cursor-pointer ${
              isDark
                ? 'bg-slate-900/60 border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-900/90 shadow-xl'
                : 'bg-white/80 border-slate-200/90 hover:border-emerald-300 hover:bg-white shadow-md shadow-slate-200/50 hover:shadow-xl'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                isDark
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={`p-6 rounded-2xl border transition-all duration-300 backdrop-blur-sm space-y-3.5 group cursor-pointer ${
              isDark
                ? 'bg-slate-900/60 border-slate-800/80 hover:border-rose-500/50 hover:bg-slate-900/90 shadow-xl'
                : 'bg-white/80 border-slate-200/90 hover:border-rose-300 hover:bg-white shadow-md shadow-slate-200/50 hover:shadow-xl'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                isDark
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
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className={`border-t py-8 text-center text-xs transition-colors duration-300 ${
          isDark
            ? 'border-slate-900 bg-slate-950 text-slate-500'
            : 'border-slate-200 bg-slate-100/75 text-slate-500'
        }`}
      >
        <p>© 2026 AI Incident Commander. Designed for secure high-availability operations.</p>
      </footer>
    </div>
  );
}
