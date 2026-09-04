'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Radio,
  ShieldCheck,
  BarChart3,
  Mic,
  Brain,
  Clock,
  Users,
  CheckCircle2,
  Globe,
  Zap,
  Lock,
} from 'lucide-react';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

const tabs = [
  { id: 'voice', label: 'Voice AI Bridge' },
  { id: 'analysis', label: 'Live Analysis' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'postmortem', label: 'Post-Mortem' },
];

const features = [
  {
    icon: Radio,
    title: 'Voice bridge',
    desc: 'Join a live call with your team. AI listens, speaks, and keeps everyone on the same page during an outage.',
  },
  {
    icon: Brain,
    title: 'Smart analysis',
    desc: 'AI reads what people say and checks it against your data. It flags wrong info before it spreads.',
  },
  {
    icon: ShieldCheck,
    title: 'Conflict detection',
    desc: 'When two people disagree, the system spots it and asks the team to confirm the facts.',
  },
  {
    icon: Clock,
    title: 'Live timeline',
    desc: 'Every action, decision, and update is saved in order. You can replay the full incident later.',
  },
  {
    icon: Users,
    title: 'Team approvals',
    desc: 'Risky moves need a sign-off. The AI asks for approval before running important actions.',
  },
  {
    icon: BarChart3,
    title: 'Post-mortem reports',
    desc: 'When the incident ends, get a clean summary with root cause, timeline, and lessons learned.',
  },
];

const useCases = [
  {
    title: 'Production outages',
    desc: 'Run a voice bridge when your app goes down. AI helps triage, track actions, and write the report.',
    gradient: 'from-purple-900/40 to-indigo-900/40',
  },
  {
    title: 'Security incidents',
    desc: 'Keep a clear record of who said what during a breach response. Every decision is logged.',
    gradient: 'from-blue-900/40 to-cyan-900/40',
  },
  {
    title: 'On-call handoffs',
    desc: 'Pass context between shifts with a full voice timeline. No more lost notes or missed details.',
    gradient: 'from-emerald-900/40 to-teal-900/40',
  },
];

function ArrowBtn({ className = '' }: { className?: string }) {
  return (
    <span className={`w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0 ${className}`}>
      <ArrowUpRight className="w-3 h-3 text-white" />
    </span>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('voice');

  return (
    <div className="landing-bg min-h-screen font-sans">
      <LandingHeader />

      {/* Announcement banner */}
      <div className="gradient-banner py-2.5 px-4 text-center">
        <p className="text-sm font-medium text-black">
          Introducing Agora VoiceBridge — Real-time AI voice intelligence for outage bridge calls
        </p>
      </div>

      <main>
        {/* ── Hero ── */}
        <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/60 uppercase tracking-widest mb-8">
              Real-Time Voice AI Platform
            </span>
            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white via-white to-[#33d1ff] bg-clip-text text-transparent">
              Agora VoiceBridge
            </h1>
            <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
              The easiest way to run{' '}
              <span className="gradient-text font-semibold">real-time AI voice bridges</span>{' '}
              for outage triage — live calls, conflict detection, and auditable timelines.
            </p>
          </motion.div>

          {/* Product preview mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16 mx-auto max-w-4xl"
          >
            <div className="landing-card p-1 rounded-2xl overflow-hidden">
              <div className="bg-[#0d0d0d] rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-3 text-xs text-white/30 font-mono">incident-bridge.live</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="landing-card p-4 space-y-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Agent Type</p>
                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-sm">
                      <span>Outage Commander</span>
                      <span className="text-white/30">▾</span>
                    </div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mt-2">Model</p>
                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-sm">
                      <span>GPT-4o Mini</span>
                      <span className="text-white/30">▾</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center py-8">
                    <div className="phone-mockup">
                      <div className="bg-gradient-to-b from-purple-950 to-indigo-950 p-6 flex flex-col items-center justify-center h-48 relative">
                        <div className="voice-orb" />
                        <p className="text-xs text-white/60 mt-4">AI Commander</p>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="absolute rounded-full border border-white/10"
                              style={{ width: 60 + i * 40, height: 60 + i * 40 }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4 text-red-400" />
                          <span className="text-xs text-white/50">Live — 4 participants</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full w-3/4 bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="landing-card p-4 space-y-3">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Features</p>
                    {['Recording', 'Live transcript', 'Auto timeline'].map((f, i) => (
                      <div key={f} className="flex items-center justify-between text-sm">
                        <span className="text-white/70">{f}</span>
                        <div className={`w-9 h-5 rounded-full flex items-center px-0.5 ${i < 2 ? 'bg-[#33d1ff] justify-end' : 'bg-white/10 justify-start'}`}>
                          <div className="w-4 h-4 rounded-full bg-white shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Customize section ── */}
        <section className="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-tight">
              Customize anything &amp; everything
            </h2>
            <p className="text-white/50 text-lg leading-relaxed mb-8">
              Set up your voice bridge in minutes. Pick your AI model, write a custom prompt,
              and connect it to your incident workflow — all from a simple dashboard.
            </p>
            <Link href="/incidents/new" className="btn-landing-outline">
              Go to Quickstart
              <ArrowBtn className="!bg-white" />
            </Link>
          </div>
          <div className="code-block p-6">
            <div className="flex gap-1.5 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <pre className="text-white/80 overflow-x-auto">
              <code>{`// Start a voice incident bridge
const bridge = await commander.create({
  title: "Checkout outage SEV1",
  aiAgent: "outage-commander",
  model: "gpt-4o-mini",
  features: {
    recording: true,
    liveTranscript: true,
    autoTimeline: true,
  },
});

// Join the live call
await bridge.join({ role: "commander" });`}</code>
            </pre>
          </div>
        </section>

        {/* ── Deploy fast + tabs ── */}
        <section className="max-w-7xl mx-auto px-6 py-24 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Fix outages faster
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto mb-12">
            Pre-built tools for voice calls, live analysis, and incident tracking — ready to use today.
          </p>

          <div className="inline-flex flex-wrap justify-center gap-1 p-1.5 rounded-full bg-white/5 border border-white/10 mb-12">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-pill ${activeTab === tab.id ? 'tab-pill-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="landing-card rounded-2xl p-8 sm:p-12 bg-gradient-to-br from-blue-950/50 to-indigo-950/30 min-h-[280px] flex items-center justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
              {activeTab === 'voice' && (
                <>
                  <div className="landing-card p-5 text-left">
                    <Mic className="w-6 h-6 text-[#33d1ff] mb-3" />
                    <p className="font-semibold mb-1">Live voice call</p>
                    <p className="text-sm text-white/50">Talk with your team. AI joins and listens in real time.</p>
                  </div>
                  <div className="landing-card p-5 text-left">
                    <Radio className="w-6 h-6 text-purple-400 mb-3" />
                    <p className="font-semibold mb-1">Multi-party audio</p>
                    <p className="text-sm text-white/50">Everyone hears the same AI updates at the same time.</p>
                  </div>
                </>
              )}
              {activeTab === 'analysis' && (
                <>
                  <div className="landing-card p-5 text-left">
                    <Brain className="w-6 h-6 text-[#33d1ff] mb-3" />
                    <p className="font-semibold mb-1">Fact checking</p>
                    <p className="text-sm text-white/50">AI checks claims against your monitoring data.</p>
                  </div>
                  <div className="landing-card p-5 text-left">
                    <ShieldCheck className="w-6 h-6 text-purple-400 mb-3" />
                    <p className="font-semibold mb-1">Conflict alerts</p>
                    <p className="text-sm text-white/50">Spots when two people say different things.</p>
                  </div>
                </>
              )}
              {activeTab === 'timeline' && (
                <>
                  <div className="landing-card p-5 text-left">
                    <Clock className="w-6 h-6 text-[#33d1ff] mb-3" />
                    <p className="font-semibold mb-1">Event log</p>
                    <p className="text-sm text-white/50">Every action saved with a timestamp.</p>
                  </div>
                  <div className="landing-card p-5 text-left">
                    <BarChart3 className="w-6 h-6 text-purple-400 mb-3" />
                    <p className="font-semibold mb-1">Full replay</p>
                    <p className="text-sm text-white/50">Go back and see exactly what happened and when.</p>
                  </div>
                </>
              )}
              {activeTab === 'approvals' && (
                <>
                  <div className="landing-card p-5 text-left">
                    <CheckCircle2 className="w-6 h-6 text-[#33d1ff] mb-3" />
                    <p className="font-semibold mb-1">Sign-off flow</p>
                    <p className="text-sm text-white/50">Risky actions need team approval first.</p>
                  </div>
                  <div className="landing-card p-5 text-left">
                    <Users className="w-6 h-6 text-purple-400 mb-3" />
                    <p className="font-semibold mb-1">Role-based access</p>
                    <p className="text-sm text-white/50">Only the right people can approve big changes.</p>
                  </div>
                </>
              )}
              {activeTab === 'postmortem' && (
                <>
                  <div className="landing-card p-5 text-left">
                    <BarChart3 className="w-6 h-6 text-[#33d1ff] mb-3" />
                    <p className="font-semibold mb-1">Auto summary</p>
                    <p className="text-sm text-white/50">AI writes the post-mortem from the live timeline.</p>
                  </div>
                  <div className="landing-card p-5 text-left">
                    <Lock className="w-6 h-6 text-purple-400 mb-3" />
                    <p className="font-semibold mb-1">Audit trail</p>
                    <p className="text-sm text-white/50">Tamper-proof record for compliance and review.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Features grid ── */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-center mb-16">
            What you get
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">
            {features.map((f) => (
              <div key={f.title} className="flex gap-5 landing-card-hover">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-white/60" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bento grid ── */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <div className="bento-grid">
            <div className="landing-card landing-card-hover p-6 col-span-1">
              <h3 className="font-bold text-lg mb-2">Fast setup</h3>
              <p className="text-sm text-white/50 mb-6">Start a voice bridge in under 2 minutes. No complex config needed.</p>
              <div className="flex items-end gap-1 h-16">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-[#33d1ff]/30 to-[#33d1ff] rounded-sm" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            <div className="landing-card landing-card-hover p-6 col-span-1">
              <h3 className="font-bold text-lg mb-4">Built to stay online</h3>
              <div className="space-y-3">
                {[
                  { label: '99.99% uptime', icon: Zap },
                  { label: '24/7 voice support', icon: Globe },
                  { label: 'Zero data loss', icon: Lock },
                ].map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <Icon className="w-4 h-4 text-[#33d1ff]" />
                    <span className="text-white/70">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-card landing-card-hover p-6 col-span-1">
              <h3 className="font-bold text-lg mb-4">Full control</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {['#33d1ff', '#a855f7', '#06b6d4', '#f97316'].map((c) => (
                    <div key={c} className="w-8 h-8 rounded-lg" style={{ background: c }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  {['HD', 'FHD', '4K'].map((r, i) => (
                    <span key={r} className={`text-xs px-2 py-1 rounded-md ${i === 1 ? 'bg-white text-black' : 'bg-white/10 text-white/60'}`}>{r}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="landing-card landing-card-hover p-6 col-span-1">
              <h3 className="font-bold text-lg mb-2">Global reach</h3>
              <p className="text-sm text-white/50 mb-4">Low-latency voice in 200+ countries via Agora.</p>
              <div className="relative h-20 overflow-hidden rounded-lg bg-white/5">
                <div className="absolute inset-0 opacity-30" style={{
                  backgroundImage: 'radial-gradient(circle, #33d1ff 1px, transparent 1px)',
                  backgroundSize: '8px 8px',
                }} />
              </div>
            </div>

            <div className="landing-card landing-card-hover p-6 col-span-2">
              <h3 className="font-bold text-lg mb-2">Ready for your team</h3>
              <p className="text-sm text-white/50 mb-6">Built with security and compliance in mind for production use.</p>
              <div className="flex gap-4">
                {['SOC 2', 'GDPR', 'HIPAA'].map((badge) => (
                  <div key={badge} className="w-16 h-16 rounded-full bg-[#33d1ff]/10 border border-[#33d1ff]/30 flex items-center justify-center text-xs font-bold text-[#33d1ff]">
                    {badge}
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-card landing-card-hover p-6 col-span-2">
              <h3 className="font-bold text-lg mb-2">Easy to connect</h3>
              <p className="text-sm text-white/50 mb-4">Works with your existing stack — Next.js, Prisma, OpenAI, and Agora SDK.</p>
              <div className="code-block p-4 text-xs">
                <code className="text-emerald-400">npm install</code>
                <span className="text-white/60"> && </span>
                <code className="text-emerald-400">npm run dev</code>
              </div>
            </div>
          </div>
        </section>

        {/* ── Why section ── */}
        <section className="max-w-7xl mx-auto px-6 py-24 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold gradient-text mb-6">
            Why Incident Commander?
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto mb-16 leading-relaxed">
            On-call teams need clear communication when things break. This tool gives you a live voice room,
            an AI that listens and helps, and a full record of every decision — so nothing gets lost.
          </p>
          <div className="landing-card rounded-2xl p-8 border border-white/10 max-w-3xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { value: '3.4x', label: 'Faster fixes' },
                { value: '99.4%', label: 'Fact accuracy' },
                { value: '<200ms', label: 'Voice delay' },
                { value: '100%', label: 'Audit coverage' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl sm:text-3xl font-bold text-[#33d1ff] mb-1">{stat.value}</div>
                  <div className="text-xs text-white/40">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Use cases ── */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40 mb-3">Use cases</p>
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
                Built for real incidents
              </h2>
            </div>
            <Link href="/incidents" className="btn-landing-outline shrink-0">
              View All
              <ArrowBtn className="!bg-white" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {useCases.map((uc) => (
              <div key={uc.title} className="landing-card landing-card-hover overflow-hidden group">
                <div className={`h-48 bg-gradient-to-br ${uc.gradient} flex items-center justify-center`}>
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Radio className="w-8 h-8 text-white/60" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-lg mb-2">{uc.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{uc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-7xl mx-auto px-6 pb-24">
          <div className="landing-card rounded-3xl p-10 sm:p-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-950/20 to-cyan-950/20 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Get started in minutes
              </h2>
              <p className="text-white/50 text-lg mb-8 leading-relaxed">
                Open the dashboard, start a new incident, and join the voice bridge. No credit card needed for local dev.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/incidents/new" className="btn-landing-primary">
                  Try for Free
                  <ArrowBtn />
                </Link>
                <Link href="/incidents" className="btn-landing-outline">
                  Open Dashboard
                </Link>
              </div>
            </div>
            <div className="relative z-10 flex justify-center">
              <div className="w-full max-w-sm landing-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Live incident room</p>
                    <p className="text-xs text-white/40">4 engineers connected</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {['Checkout API down — SEV1', 'AI: Rollback suggested', 'Approval pending'].map((msg, i) => (
                    <div key={msg} className={`text-xs px-3 py-2 rounded-lg ${i === 0 ? 'bg-red-500/10 text-red-300' : i === 1 ? 'bg-purple-500/10 text-purple-300' : 'bg-yellow-500/10 text-yellow-300'}`}>
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div id="support">
        <LandingFooter />
      </div>
    </div>
  );
}
