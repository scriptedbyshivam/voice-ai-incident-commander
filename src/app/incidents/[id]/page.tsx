'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import {
  IncidentState,
  ParticipantSummary,
  FactSummary,
  HypothesisSummary,
  DecisionSummary,
  ActionItemSummary,
  ConflictSummary,
  OpenQuestionSummary,
  TimelineEventSummary,
  EvidenceMetadata,
  IncidentStatus,
  Severity,
} from '@/types/incident';
import {
  Zap,
  Radio,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Users,
  Activity,
  PhoneCall,
  Terminal,
  Volume2,
  FileText,
  ChevronRight,
  Plus,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function IncidentDashboard({ params }: PageProps) {
  const { id: incidentId } = use(params);
  const { isDark } = useTheme();

  // States
  const [state, setState] = useState<IncidentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbMode, setDbMode] = useState<'LIVE' | 'SIMULATED'>('LIVE');
  const [activeTab, setActiveTab] = useState<'facts' | 'hypotheses' | 'conflicts' | 'actions' | 'timeline'>('facts');
  const [isSimulatingSpeech, setIsSimulatingSpeech] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  const calculateDuration = (createdStr: string) => {
    const created = new Date(createdStr).getTime();
    const diffMins = Math.floor((currentTime - created) / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  // Fetch Incident State from backend
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`);
      if (!res.ok) throw new Error('Incident not found');
      const data = await res.json();
      setState(data);
      setDbMode('LIVE');
    } catch (err) {
      setDbMode('SIMULATED');
      // Fallback local mock state if DB is offline
      setState((prev) => {
        if (prev) return prev;
        return {
          incidentId,
          title: 'Payment Gateway API Outage',
          description: 'Checkout failure rate is currently at 42% on payment microservice cluster.',
          currentStatus: 'ACTIVE',
          severity: 'SEV1',
          createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
          participants: [
            { id: 'p-1', userId: 'u-1', name: 'Rahul Sharma', role: 'ENGINEER', joinedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), leftAt: null },
            { id: 'p-2', userId: 'u-2', name: 'Priya Patel', role: 'SUPPORT', joinedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), leftAt: null },
            { id: 'p-3', userId: 'u-3', name: 'Amit Kumar', role: 'SRE', joinedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), leftAt: null }
          ],
          confirmedFacts: [
            {
              id: 'f-1',
              title: 'Checkout Failure Spike',
              description: 'Payment failure rate is currently at 42% on payment microservice.',
              status: 'CONFIRMED',
              evidence: {
                sourceType: 'MONITORING',
                sourceId: 'alert-datadog-109',
                sourceText: 'checkout.payment.failure.rate > 40%',
                timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
                confidence: 1.0,
                verificationStatus: 'VERIFIED'
              },
              createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString()
            }
          ],
          reportedObservations: [
            {
              id: 'f-2',
              title: 'Customer Support Timeout Queue',
              description: 'Support backlog showing 120+ checkout gateway timeout tickets.',
              status: 'REPORTED',
              evidence: {
                sourceType: 'SLACK',
                sourceText: 'Multiple users calling about failed orders.',
                timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
                confidence: 0.8,
                verificationStatus: 'UNVERIFIED'
              },
              createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString()
            }
          ],
          hypotheses: [
            {
              id: 'h-1',
              title: 'Canary Deployment Regression',
              description: 'Recent deployment of payment-routing microservice v2.4.1 may be contributing.',
              status: 'REPORTED',
              evidence: {
                sourceType: 'HUMAN_SPOKEN',
                speakerId: 'Priya',
                sourceText: 'We deployed the new checkout routing rules 10 minutes before the failures spiked.',
                timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
                confidence: 0.7,
                verificationStatus: 'UNVERIFIED'
              },
              createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString()
            }
          ],
          decisions: [
            {
              id: 'd-1',
              title: 'Rollback Deployment v2.4.1',
              description: 'Bridge agreed to trigger immediate canary rollback to restore baseline latency.',
              decidedBy: 'Rahul Sharma',
              evidence: { sourceType: 'MANUAL_CONFIRMATION', timestamp: new Date().toISOString(), confidence: 1.0, verificationStatus: 'VERIFIED' },
              createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString()
            }
          ],
          actions: [
            {
              id: 'a-1',
              title: 'Execute Canary Rollback Script',
              description: 'Run deployment rollback script on payment-routing cluster',
              status: 'PENDING',
              assigneeName: 'Rahul Sharma',
              assigneeId: 'p-1',
              evidence: {
                sourceType: 'MANUAL_CONFIRMATION',
                sourceText: 'Rahul volunteered to trigger rollout undo.',
                timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                confidence: 1.0,
                verificationStatus: 'VERIFIED'
              },
              createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
              history: []
            }
          ],
          conflicts: [
            {
              id: 'c-1',
              topic: 'Database Performance Disagreement',
              claimA: 'Rahul reports high DB latency of 800ms+ in app server logs.',
              claimB: 'Amit reports database read charts on Grafana look normal (<15ms).',
              sourceA: {
                sourceType: 'HUMAN_SPOKEN',
                speakerId: 'Rahul',
                sourceText: 'I am seeing high database connection latency from app server logs.',
                timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
                confidence: 0.85,
                verificationStatus: 'DISPUTED'
              },
              sourceB: {
                sourceType: 'HUMAN_SPOKEN',
                speakerId: 'Amit',
                sourceText: 'Amit says read graphs look flat on dashboard.',
                timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
                confidence: 0.8,
                verificationStatus: 'DISPUTED'
              },
              status: 'UNRESOLVED',
              detectedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
              createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
            }
          ],
          unresolvedRisks: [
            'Conflict Topic: Database Performance Disagreement',
            'Open Question: What was the exact release hash deployed at 23:30?'
          ],
          openQuestions: [],
          timeline: [
            { id: 't-1', eventType: 'INCIDENT_CREATED', description: 'Incident declared: checkout.payment.failure.rate > 40%', eventTime: new Date(Date.now() - 35 * 60 * 1000).toISOString(), evidence: { sourceType: 'MONITORING', timestamp: '', confidence: 1.0, verificationStatus: 'VERIFIED' }, createdAt: '' },
            { id: 't-2', eventType: 'PARTICIPANT_JOINED', description: 'Rahul Sharma (Engineer) and Priya Patel (Support) joined voice bridge', eventTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), evidence: { sourceType: 'MANUAL_CONFIRMATION', timestamp: '', confidence: 1.0, verificationStatus: 'VERIFIED' }, createdAt: '' },
            { id: 't-3', eventType: 'CONFLICT', description: 'DB metrics discrepancy logged: 800ms vs normal dashboard', eventTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), evidence: { sourceType: 'HUMAN_SPOKEN', timestamp: '', confidence: 1.0, verificationStatus: 'VERIFIED' }, createdAt: '' }
          ],
          latestSummary: null
        };
      });
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchState();
    const timer = setInterval(() => {
      fetchState();
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, [fetchState]);

  const handleUpdateStatus = async (newStatus: 'ACTIVE' | 'RESOLVED' | 'CLOSED') => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionComplete = async (actionId: string) => {
    if (!state) return;
    setState({
      ...state,
      actions: state.actions.map(a => a.id === actionId ? { ...a, status: 'COMPLETED' as const } : a)
    });
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center space-y-4 ${
        isDark ? 'bg-[#141720] text-[#f1f5f9]' : 'bg-[#e0e5ec] text-[#2d3436]'
      }`}>
        <div className="w-10 h-10 border-4 border-[#ff4757] border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-xs text-slate-500 uppercase tracking-widest font-bold">
          CONNECTING INCIDENT TELEMETRY BUS...
        </span>
      </div>
    );
  }

  if (!state) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${
        isDark ? 'bg-[#141720] text-[#f1f5f9]' : 'bg-[#e0e5ec] text-[#2d3436]'
      }`}>
        <h2 className="text-2xl font-bold font-sans">Incident Bridge Not Found</h2>
        <Link href="/incidents" className="text-[#ff4757] font-mono text-sm underline">
          Return to Incident Control Hub
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen font-sans pb-16 transition-colors duration-300 flex flex-col ${
        isDark ? 'bg-[#141720] text-[#f1f5f9]' : 'bg-[#e0e5ec] text-[#2d3436]'
      }`}
    >
      {/* Industrial Machine Header */}
      <header className="sticky top-0 z-40 px-6 py-4">
        <div
          className={`max-w-7xl mx-auto px-6 h-18 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between border transition-all duration-300 shadow-industrial-card gap-4 ${
            isDark ? 'bg-[#1b202c]/90 border-[#232a3a]' : 'bg-[#f0f2f5]/90 border-white/60'
          }`}
        >
          <div className="flex items-center gap-4">
            <Link
              href="/incidents"
              className="btn-mechanical-chassis px-3 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1 border border-white/30 dark:border-white/5"
            >
              ← HUB
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold uppercase text-[#ff4757] tracking-widest">
                  BRIDGE // {state.incidentId.slice(0, 12)}
                </span>
                <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed text-slate-700 dark:text-slate-300">
                  {dbMode === 'LIVE' ? 'DB CONNECTED' : 'SANDBOX SIMULATED'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold font-sans tracking-tight embossed-text">
                {state.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Switcher */}
            <div className="flex p-1 rounded-xl bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed gap-1">
              <button
                onClick={() => handleUpdateStatus('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                  state.currentStatus === 'ACTIVE'
                    ? 'btn-mechanical-primary'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                OUTAGE ACTIVE
              </button>
              <button
                onClick={() => handleUpdateStatus('RESOLVED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                  state.currentStatus === 'RESOLVED'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                RESOLVED
              </button>
            </div>

            {/* SEV Metal Tag */}
            <span className="px-3 py-1.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider bg-[#ff4757] text-white shadow-industrial-accent">
              {state.severity}
            </span>

            {/* Voice Bridge Launch Key */}
            <Link
              href={`/incidents/${incidentId}/room`}
              className="btn-mechanical-primary px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Voice Room</span>
            </Link>

            <div className="h-6 w-1 rounded-full bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed" />

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Operations Grid */}
      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 w-full">
        
        {/* LEFT COLUMN: TELEMETRY & INCIDENT STATE (4 cols) */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* Card 1: Machine Telemetry */}
          <div
            className={`p-6 rounded-3xl border shadow-industrial-card corner-screws space-y-4 ${
              isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
            }`}
          >
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-2">
              <h2 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>BRIDGE TELEMETRY</span>
              </h2>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 led-glow-green animate-pulse" />
                <span className="text-[9px] font-mono font-bold text-slate-500">LIVE</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-2xl bg-[#d1d9e6]/50 dark:bg-[#0e1017]/60 shadow-industrial-recessed">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">STATUS</span>
                <span className="font-extrabold text-[#ff4757] block mt-0.5">{state.currentStatus}</span>
              </div>
              <div className="p-3 rounded-2xl bg-[#d1d9e6]/50 dark:bg-[#0e1017]/60 shadow-industrial-recessed">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">DURATION</span>
                <span className="font-extrabold text-emerald-500 block mt-0.5">{calculateDuration(state.createdAt)}</span>
              </div>
            </div>

            {state.description && (
              <div className="p-3 rounded-2xl bg-[#d1d9e6]/40 dark:bg-[#0e1017]/50 shadow-industrial-recessed text-xs leading-relaxed">
                <span className="text-[9px] font-mono uppercase text-slate-500 font-bold block mb-1">IMPACT PROFILE</span>
                <p className="text-slate-700 dark:text-slate-300 font-medium">{state.description}</p>
              </div>
            )}
          </div>

          {/* Card 2: Bridge Participants Intercom Roster */}
          <div
            className={`p-6 rounded-3xl border shadow-industrial-card corner-screws space-y-4 ${
              isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
            }`}
          >
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-2">
              <h2 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>INTERCOM ROSTER ({state.participants.length})</span>
              </h2>
            </div>

            <div className="space-y-2">
              {state.participants.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl bg-[#d1d9e6]/40 dark:bg-[#0e1017]/50 shadow-industrial-recessed flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-[#ff4757] text-white flex items-center justify-center font-mono font-bold text-xs shadow-industrial-accent">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold font-sans">{p.name}</div>
                      <div className="text-[9px] font-mono uppercase text-[#ff4757] font-bold">{p.role}</div>
                    </div>
                  </div>

                  <span className="w-2 h-2 rounded-full bg-emerald-500 led-glow-green" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: INTELLIGENCE STATE, HYPOTHESES, & AUDIT TRAIL (8 cols) */}
        <section className="lg:col-span-8 space-y-6">
          
          {/* Hardware Navigation Tab Switcher */}
          <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed">
            {(['facts', 'hypotheses', 'conflicts', 'actions', 'timeline'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'btn-mechanical-primary'
                    : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white'
                }`}
              >
                {tab === 'facts' && `Facts (${state.confirmedFacts.length})`}
                {tab === 'hypotheses' && `Hypotheses (${state.hypotheses.length})`}
                {tab === 'conflicts' && `Conflicts (${state.conflicts.length})`}
                {tab === 'actions' && `Actions (${state.actions.length})`}
                {tab === 'timeline' && `Audit Log (${state.timeline.length})`}
              </button>
            ))}
          </div>

          {/* TAB 1: FACTS & OBSERVATIONS */}
          {activeTab === 'facts' && (
            <div
              className={`p-6 sm:p-8 rounded-3xl border shadow-industrial-card corner-screws space-y-4 ${
                isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
              }`}
            >
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] pb-2 border-b border-black/5 dark:border-white/10">
                VERIFIED FACTS &amp; TELEMETRY SIGNALS
              </h3>

              <div className="space-y-4">
                {state.confirmedFacts.map((fact) => (
                  <div
                    key={fact.id}
                    className="p-5 rounded-2xl bg-[#d1d9e6]/40 dark:bg-[#0e1017]/50 shadow-industrial-recessed space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold font-sans">{fact.title}</span>
                      <span className="px-2.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                        {fact.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#4a5568] dark:text-[#94a3b8] leading-relaxed">{fact.description}</p>
                    <div className="text-[10px] font-mono text-slate-500 pt-1">
                      SOURCE: {fact.evidence.sourceType} // REF: {fact.evidence.sourceId || 'SPOKEN_CALL'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: HYPOTHESES */}
          {activeTab === 'hypotheses' && (
            <div
              className={`p-6 sm:p-8 rounded-3xl border shadow-industrial-card corner-screws space-y-4 ${
                isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
              }`}
            >
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] pb-2 border-b border-black/5 dark:border-white/10">
                TRIAGE HYPOTHESES &amp; POTENTIAL ROOT CAUSES
              </h3>

              <div className="space-y-4">
                {state.hypotheses.map((hyp) => (
                  <div
                    key={hyp.id}
                    className="p-5 rounded-2xl bg-[#d1d9e6]/40 dark:bg-[#0e1017]/50 shadow-industrial-recessed space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold font-sans">{hyp.title}</span>
                      <span className="px-2.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-950/60 text-amber-400 border border-amber-800/60">
                        {hyp.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#4a5568] dark:text-[#94a3b8] leading-relaxed">{hyp.description}</p>
                    <div className="text-[10px] font-mono text-slate-500 pt-1">
                      DISPATCHED BY: {hyp.evidence.speakerId || 'ENGINEERING TEAM'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CONFLICTS */}
          {activeTab === 'conflicts' && (
            <div
              className={`p-6 sm:p-8 rounded-3xl border shadow-industrial-card corner-screws space-y-4 ${
                isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
              }`}
            >
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] pb-2 border-b border-black/5 dark:border-white/10">
                DISCREPANCIES &amp; CONTRADICTORY STATEMENTS
              </h3>

              <div className="space-y-4">
                {state.conflicts.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl bg-rose-950/20 border border-rose-800/40 space-y-3 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between text-[#ff4757] font-bold">
                      <span>CONFLICT: {c.topic}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 text-[9px]">UNRESOLVED</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-3 rounded-xl bg-black/40 border border-rose-900/40">
                        <span className="text-slate-400 block text-[9px] font-bold">CLAIM A</span>
                        {c.claimA}
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-rose-900/40">
                        <span className="text-slate-400 block text-[9px] font-bold">CLAIM B</span>
                        {c.claimB}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: ACTIONS */}
          {activeTab === 'actions' && (
            <div
              className={`p-6 sm:p-8 rounded-3xl border shadow-industrial-card corner-screws space-y-4 ${
                isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
              }`}
            >
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] pb-2 border-b border-black/5 dark:border-white/10">
                COMMAND ACTIONS &amp; DELEGATIONS
              </h3>

              <div className="space-y-4">
                {state.actions.map((act) => (
                  <div
                    key={act.id}
                    className="p-5 rounded-2xl bg-[#d1d9e6]/40 dark:bg-[#0e1017]/50 shadow-industrial-recessed flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-bold font-sans">{act.title}</div>
                      <p className="text-xs text-[#4a5568] dark:text-[#94a3b8]">{act.description}</p>
                      <div className="text-[10px] font-mono text-slate-500 font-bold">
                        ASSIGNEE: {act.assigneeName || 'UNASSIGNED'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleActionComplete(act.id)}
                      className={`btn-mechanical-primary px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider cursor-pointer ${
                        act.status === 'COMPLETED' ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      {act.status === 'COMPLETED' ? 'COMPLETED' : 'CONFIRM DONE'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOG TIMELINE */}
          {activeTab === 'timeline' && (
            <div
              className={`p-6 sm:p-8 rounded-3xl border shadow-industrial-card corner-screws space-y-4 ${
                isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
              }`}
            >
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] pb-2 border-b border-black/5 dark:border-white/10">
                DETERMINISTIC EVENT AUDIT LOG
              </h3>

              <div className="space-y-3 font-mono text-xs">
                {state.timeline.map((evt, idx) => (
                  <div
                    key={evt.id || idx}
                    className="p-3.5 rounded-2xl bg-[#d1d9e6]/40 dark:bg-[#0e1017]/50 shadow-industrial-recessed flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-[#ff4757]" />
                      <span className="font-bold text-[#ff4757] text-[10px]">{evt.eventType}</span>
                      <span className="text-slate-700 dark:text-slate-300">{evt.description}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0">
                      {new Date(evt.eventTime || Date.now()).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
