'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'motion/react';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import {
  Radio,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Zap,
  Activity,
  CheckCircle2,
  Clock,
  Volume2,
  AlertTriangle,
  Cpu,
  Terminal,
  Sliders,
  Sparkles,
  Server,
  Layers,
  PhoneCall
} from 'lucide-react';

export default function Home() {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll-Driven Parallax & Blur Transforms
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.94]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0.6]);
  const heroFilter = useTransform(scrollYProgress, [0, 0.25], ['blur(0px)', 'blur(8px)']);
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -40]);

  const consoleScale = useTransform(scrollYProgress, [0.05, 0.35], [0.95, 1.02]);
  const consoleRotateX = useTransform(scrollYProgress, [0.05, 0.35], [8, 0]);

  return (
    <div
      ref={containerRef}
      className={`min-h-screen font-sans flex flex-col relative transition-colors duration-300 ${
        isDark ? 'bg-[#141720] text-[#f1f5f9]' : 'bg-[#e0e5ec] text-[#2d3436]'
      }`}
    >
      {/* Top Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-[#ff4757] origin-left z-50 shadow-[0_0_8px_#ff4757]"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Industrial Machine Header */}
      <header className="sticky top-0 z-40 px-6 py-4">
        <div
          className={`max-w-7xl mx-auto px-6 h-16 rounded-2xl flex items-center justify-between border transition-all duration-300 shadow-industrial-card ${
            isDark
              ? 'bg-[#1b202c]/90 border-[#232a3a]'
              : 'bg-[#f0f2f5]/90 border-white/60'
          }`}
        >
          {/* Logo & Hardware Identifier */}
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[#ff4757] text-white flex items-center justify-center font-bold text-lg shadow-industrial-accent active:translate-y-0.5">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight font-sans embossed-text">
                  AI Incident Commander
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-[#d1d9e6] dark:bg-[#0e1017] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/10">
                  REV 4.2
                </span>
              </div>
            </div>
          </div>

          {/* System Telemetry & Controls */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* LED Status Beacon */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full shadow-industrial-recessed bg-[#d1d9e6] dark:bg-[#0e1017]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 led-glow-green animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-wider text-slate-700 dark:text-slate-300 uppercase">
                SYS.ONLINE
              </span>
            </div>

            <Link
              href="/incidents"
              className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-colors hover:text-[#ff4757]"
            >
              Control Hub
            </Link>

            <Link
              href="/incidents/new"
              className="btn-mechanical-primary px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider hidden sm:flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Declare Outage</span>
            </Link>

            {/* Vertical Chassis Groove */}
            <div className="h-6 w-1 rounded-full bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed" />

            {/* Machined Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 sm:py-12 flex flex-col justify-center relative space-y-20 sm:space-y-28">
        
        {/* HERO SECTION */}
        <motion.section
          style={{
            scale: heroScale,
            opacity: heroOpacity,
            filter: heroFilter,
            y: heroY,
          }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-4 sm:pt-8"
        >
          {/* Left Hero Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Stamped Model Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#ff4757] led-glow-red animate-pulse" />
              <span>MODULE // AI-CMD-4000 // TACTILE DISPATCH</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight font-sans leading-[1.05] embossed-text">
              Autonomous Voice AI Incident <span className="text-[#ff4757]">Commander.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#4a5568] dark:text-[#94a3b8] leading-relaxed max-w-2xl font-medium">
              A high-precision operational voice bridge with real-time autonomous situational intelligence, dynamic conflict arbitration, timeline recording, and verifiable decision governance.
            </p>

            {/* Hardware Push-Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/incidents/new"
                className="btn-mechanical-primary px-6 py-3.5 rounded-2xl font-mono font-bold text-sm tracking-wider uppercase flex items-center gap-2.5 cursor-pointer"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                <span>Initialize Voice Bridge</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/incidents"
                className="btn-mechanical-chassis px-6 py-3.5 rounded-2xl font-mono font-bold text-sm tracking-wider uppercase border border-white/50 dark:border-white/5 flex items-center gap-2 cursor-pointer"
              >
                <Terminal className="w-4 h-4" />
                <span>Mission Dashboard</span>
              </Link>
            </div>

            {/* Spec Readout Row */}
            <div className="pt-6 grid grid-cols-3 gap-3 max-w-lg">
              <div className="p-3 rounded-xl bg-[#d1d9e6]/50 dark:bg-[#0e1017]/60 shadow-industrial-recessed text-center">
                <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">LATENCY</div>
                <div className="text-base font-mono font-black text-[#ff4757] mt-0.5">&lt; 180ms</div>
              </div>
              <div className="p-3 rounded-xl bg-[#d1d9e6]/50 dark:bg-[#0e1017]/60 shadow-industrial-recessed text-center">
                <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">SPEAKER STT</div>
                <div className="text-base font-mono font-black text-emerald-500 mt-0.5">MULTI-TRACK</div>
              </div>
              <div className="p-3 rounded-xl bg-[#d1d9e6]/50 dark:bg-[#0e1017]/60 shadow-industrial-recessed text-center">
                <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">GOVERNANCE</div>
                <div className="text-base font-mono font-black text-indigo-500 mt-0.5">VERIFIED</div>
              </div>
            </div>
          </div>

          {/* Right Hero Column: 3D Hardware Control Console Device */}
          <motion.div
            style={{
              scale: consoleScale,
              rotateX: consoleRotateX,
              transformPerspective: 1000,
            }}
            className="lg:col-span-5 relative"
          >
            {/* Outer Machine Chassis Bezel with Corner Screws & Vent Slots */}
            <div
              className={`p-6 rounded-3xl border relative transition-all duration-300 shadow-industrial-floating corner-screws ${
                isDark
                  ? 'bg-[#1b202c] border-[#2e374c]'
                  : 'bg-[#f0f2f5] border-white'
              }`}
            >
              {/* Top Hardware Panel with Model Name & Cooling Vent Slits */}
              <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff4757] led-glow-red animate-pulse" />
                  <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-[#4a5568] dark:text-[#94a3b8]">
                    LIVE BRIDGE MONITOR // CH-01
                  </span>
                </div>

                {/* 3 Recessed Cooling Vent Slots */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed">
                  <div className="h-4 w-1 rounded-full bg-slate-400/60 dark:bg-slate-700" />
                  <div className="h-4 w-1 rounded-full bg-slate-400/60 dark:bg-slate-700" />
                  <div className="h-4 w-1 rounded-full bg-slate-400/60 dark:bg-slate-700" />
                </div>
              </div>

              {/* Inner CRT Screen with Scanlines */}
              <div className="mt-4 rounded-2xl crt-screen p-5 text-emerald-400 font-mono text-xs shadow-industrial-recessed border border-emerald-950/60 space-y-4">
                {/* CRT Header */}
                <div className="flex items-center justify-between border-b border-emerald-900/60 pb-2 text-[10px]">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    CHANNEL: SEV1-OUTAGE-TRIAGE
                  </span>
                  <span className="text-emerald-600">FPS: 60 // 48kHz PCM</span>
                </div>

                {/* Simulated Live Transcript Logs */}
                <div className="space-y-2 text-[11px] leading-relaxed">
                  <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40">
                    <span className="text-[#ff4757] font-bold">[RAHUL / ENG]:</span> &quot;Spike confirmed on checkout microservice. Error rate at 42%.&quot;
                  </div>
                  <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40">
                    <span className="text-indigo-400 font-bold">[AI COMMANDER]:</span> &quot;Discrepancy detected between app server logs and DB metric graph. Conflict logged.&quot;
                  </div>
                  <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40">
                    <span className="text-amber-400 font-bold">[PRIYA / SRE]:</span> &quot;Authorizing immediate canary rollback for release v2.4.1.&quot;
                  </div>
                </div>

                {/* Hardware Audio Scope Visualization */}
                <div className="p-2 rounded bg-black/60 border border-emerald-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[16, 28, 42, 20, 36, 48, 24, 38, 18, 30, 44, 22, 34, 46].map((h, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [h * 0.4, h * 0.9, h * 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.2 + (i % 3) * 0.2, ease: 'easeInOut' }}
                        className="w-1.5 bg-gradient-to-t from-emerald-600 via-emerald-400 to-[#ff4757] rounded-full"
                        style={{ height: `${h * 0.6}px` }}
                      />
                    ))}
                  </div>
                  <div className="text-[10px] text-right text-emerald-500 font-bold">
                    <div>MIC 01: ACTIVE</div>
                    <div className="text-[8px] text-emerald-700">RMS: -14 dBFS</div>
                  </div>
                </div>
              </div>

              {/* Bottom Hardware Push Switches */}
              <div className="mt-4 flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  <button className="w-8 h-8 rounded-lg bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-sharp active:shadow-industrial-recessed flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    M1
                  </button>
                  <button className="w-8 h-8 rounded-lg bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-sharp active:shadow-industrial-recessed flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    M2
                  </button>
                  <button className="w-8 h-8 rounded-lg bg-[#ff4757] text-white shadow-industrial-accent active:shadow-industrial-accent-pressed flex items-center justify-center text-xs font-bold">
                    REC
                  </button>
                </div>

                <div className="text-[9px] font-mono uppercase text-slate-500 font-bold">
                  SERIAL #4092-A
                </div>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* PHYSICAL CONNECTING CONDUIT PIPE */}
        <div className="hidden md:flex items-center gap-4 px-12">
          <div className="conduit-pipe" />
          <span className="text-[10px] font-mono uppercase font-bold text-slate-500 whitespace-nowrap">
            SIGNAL BUS // TRIAGE ARCHITECTURE
          </span>
          <div className="conduit-pipe" />
        </div>

        {/* MODULAR HARDWARE FEATURE DECK ("BOLTED MODULES") */}
        <section className="space-y-8">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold font-sans tracking-tight embossed-text">
              Engineered for Incident Mission Control
            </h2>
            <p className="text-sm text-[#4a5568] dark:text-[#94a3b8] font-medium">
              Physical precision modules inspired by Dieter Rams engineering and mission control avionics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div
              className={`p-8 rounded-3xl border relative transition-all duration-300 shadow-industrial-card hover:-translate-y-1.5 hover:shadow-industrial-floating corner-screws group ${
                isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
              }`}
            >
              {/* Recessed Icon Housing */}
              <div className="w-14 h-14 rounded-2xl bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Radio className="w-7 h-7 text-[#ff4757]" />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-[#ff4757] tracking-wider">
                  MODULE 01 // AUDIO DSP
                </div>
                <h3 className="text-xl font-bold font-sans">Low-Latency Voice Intercom</h3>
                <p className="text-sm text-[#4a5568] dark:text-[#94a3b8] leading-relaxed">
                  Real-time Agora multi-party audio pipeline with live speaker isolation, automated noise suppression, and synchronized STT.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div
              className={`p-8 rounded-3xl border relative transition-all duration-300 shadow-industrial-card hover:-translate-y-1.5 hover:shadow-industrial-floating corner-screws group ${
                isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
              }`}
            >
              {/* Recessed Icon Housing */}
              <div className="w-14 h-14 rounded-2xl bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-7 h-7 text-[#ff4757]" />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-[#ff4757] tracking-wider">
                  MODULE 02 // ARBITRATION
                </div>
                <h3 className="text-xl font-bold font-sans">Conflict Detection &amp; Facts</h3>
                <p className="text-sm text-[#4a5568] dark:text-[#94a3b8] leading-relaxed">
                  Autonomous LLM extraction that verifies hypotheses against monitoring evidence and highlights contradictory engineering statements.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div
              className={`p-8 rounded-3xl border relative transition-all duration-300 shadow-industrial-card hover:-translate-y-1.5 hover:shadow-industrial-floating corner-screws group ${
                isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
              }`}
            >
              {/* Recessed Icon Housing */}
              <div className="w-14 h-14 rounded-2xl bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-7 h-7 text-[#ff4757]" />
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-[#ff4757] tracking-wider">
                  MODULE 03 // GOVERNANCE
                </div>
                <h3 className="text-xl font-bold font-sans">Verifiable Post-Mortems</h3>
                <p className="text-sm text-[#4a5568] dark:text-[#94a3b8] leading-relaxed">
                  Tamper-evident audit timeline tracking actions, commander approvals, hypothesis verification, and executive executive summaries.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* DARK INSTRUMENT PANEL STATS STRIP */}
        <section className="p-8 sm:p-12 rounded-3xl bg-[#1e2430] text-white border border-[#2e374c] shadow-industrial-floating relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 led-glow-green animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-[#ff4757] led-glow-red" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center sm:text-left">
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">RESOLUTION VELOCITY</div>
              <div className="text-3xl sm:text-4xl font-mono font-black text-[#ff4757]">3.4x</div>
              <p className="text-xs text-slate-400">Faster MTTR to full mitigation</p>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">EVIDENCE ACCURACY</div>
              <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-400">99.4%</div>
              <p className="text-xs text-slate-400">Verified factual claims</p>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">VOICE SYNCHRONIZATION</div>
              <div className="text-3xl sm:text-4xl font-mono font-black text-indigo-400">&lt; 200ms</div>
              <p className="text-xs text-slate-400">Global Agora edge latency</p>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#94a3b8]">AUDIT TIMELINE</div>
              <div className="text-3xl sm:text-4xl font-mono font-black text-amber-400">100%</div>
              <p className="text-xs text-slate-400">Deterministic event replay</p>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA CHASSIS PANEL */}
        <section
          className={`p-8 sm:p-12 rounded-3xl border text-center space-y-6 shadow-industrial-card corner-screws ${
            isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
            <span>OPERATIONAL BRIDGE ACTIVE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight embossed-text max-w-xl mx-auto">
            Ready to Take Autonomous Incident Command?
          </h2>

          <p className="text-sm text-[#4a5568] dark:text-[#94a3b8] max-w-md mx-auto">
            Initialize an outage bridge or inspect active incidents with tactile precision.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              href="/incidents/new"
              className="btn-mechanical-primary px-8 py-3.5 rounded-2xl font-mono font-bold text-sm tracking-wider uppercase flex items-center gap-2 cursor-pointer"
            >
              <span>Declare Outage Incident</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Industrial Machine Footer */}
      <footer className="mt-16 border-t border-black/5 dark:border-white/10 py-8 px-6 text-center text-xs font-mono text-[#4a5568] dark:text-[#94a3b8]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 led-glow-green" />
            <span>AI INCIDENT COMMANDER // SPEC: INDUSTRIAL REALISM 2026</span>
          </div>
          <div>POWERED BY NEXT.JS 16 // AGORA VOICE // DEEPGRAM // PRISMA</div>
        </div>
      </footer>
    </div>
  );
}
