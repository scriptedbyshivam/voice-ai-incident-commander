'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/landing/AppHeader';
import AISpeakerPanel from '@/components/AISpeakerPanel';
import ApprovalCard from '@/components/ApprovalCard';
import { IncidentState } from '@/types/incident';
import { Radio, Users, Activity, ShieldAlert, ShieldCheck } from 'lucide-react';

type PageProps = { params: Promise<{ id: string }> };

type Tab = 'facts' | 'hypotheses' | 'conflicts' | 'actions' | 'approvals' | 'timeline';

const MOCK_STATE = (incidentId: string): IncidentState => ({
  incidentId,
  title: 'Payment Gateway API Outage',
  description: 'Checkout failure rate is currently at 42% on payment microservice cluster.',
  currentStatus: 'ACTIVE',
  severity: 'SEV1',
  createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  participants: [
    { id: 'p-1', userId: 'u-1', name: 'Rahul Sharma', role: 'ENGINEER', joinedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), leftAt: null },
    { id: 'p-2', userId: 'u-2', name: 'Priya Patel', role: 'SUPPORT', joinedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), leftAt: null },
    { id: 'p-3', userId: 'u-3', name: 'Amit Kumar', role: 'SRE', joinedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), leftAt: null },
  ],
  confirmedFacts: [{
    id: 'f-1', title: 'Checkout Failure Spike',
    description: 'Payment failure rate is currently at 42% on payment microservice.',
    status: 'CONFIRMED',
    evidence: { sourceType: 'MONITORING', sourceId: 'alert-datadog-109', sourceText: 'checkout.payment.failure.rate > 40%', timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(), confidence: 1.0, verificationStatus: 'VERIFIED' },
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  }],
  reportedObservations: [],
  hypotheses: [{
    id: 'h-1', title: 'Canary Deployment Regression',
    description: 'Recent deployment of payment-routing microservice v2.4.1 may be contributing.',
    status: 'REPORTED',
    evidence: { sourceType: 'HUMAN_SPOKEN', speakerId: 'Priya', sourceText: 'We deployed new checkout routing rules 10 minutes before failures spiked.', timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(), confidence: 0.7, verificationStatus: 'UNVERIFIED' },
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
  }],
  decisions: [],
  actions: [{
    id: 'a-1', title: 'Execute Canary Rollback Script', description: 'Run deployment rollback script on payment-routing cluster',
    status: 'PENDING', assigneeName: 'Rahul Sharma', assigneeId: 'p-1',
    evidence: { sourceType: 'MANUAL_CONFIRMATION', sourceText: 'Rahul volunteered to trigger rollout undo.', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), confidence: 1.0, verificationStatus: 'VERIFIED' },
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), history: [],
  }],
  conflicts: [{
    id: 'c-1', topic: 'Database Performance Disagreement',
    claimA: 'Rahul reports high DB latency of 800ms+ in app server logs.',
    claimB: 'Amit reports database read charts on Grafana look normal (<15ms).',
    sourceA: { sourceType: 'HUMAN_SPOKEN', speakerId: 'Rahul', sourceText: 'High database connection latency from app server logs.', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), confidence: 0.85, verificationStatus: 'DISPUTED' },
    sourceB: { sourceType: 'HUMAN_SPOKEN', speakerId: 'Amit', sourceText: 'Read graphs look flat on dashboard.', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), confidence: 0.8, verificationStatus: 'DISPUTED' },
    status: 'UNRESOLVED', detectedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  }],
  unresolvedRisks: ['Conflict: Database Performance Disagreement'],
  openQuestions: [],
  approvals: [],
  timeline: [
    { id: 't-1', eventType: 'INCIDENT_CREATED', description: 'Incident declared: checkout.payment.failure.rate > 40%', eventTime: new Date(Date.now() - 35 * 60 * 1000).toISOString(), evidence: { sourceType: 'MONITORING', timestamp: '', confidence: 1.0, verificationStatus: 'VERIFIED' }, createdAt: '', sourceType: 'MONITORING', sourceId: null, speaker: null, confidence: 1.0, relatedEntity: null },
    { id: 't-2', eventType: 'PARTICIPANT_JOINED', description: 'Rahul Sharma and Priya Patel joined voice bridge', eventTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), evidence: { sourceType: 'MANUAL_CONFIRMATION', timestamp: '', confidence: 1.0, verificationStatus: 'VERIFIED' }, createdAt: '', sourceType: 'MANUAL_CONFIRMATION', sourceId: null, speaker: null, confidence: 1.0, relatedEntity: null },
    { id: 't-3', eventType: 'CONFLICT', description: 'DB metrics discrepancy logged: 800ms vs normal dashboard', eventTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(), evidence: { sourceType: 'HUMAN_SPOKEN', timestamp: '', confidence: 1.0, verificationStatus: 'VERIFIED' }, createdAt: '', sourceType: 'HUMAN_SPOKEN', sourceId: null, speaker: null, confidence: 1.0, relatedEntity: null },
  ],
  latestSummary: null,
});

export default function IncidentDashboard({ params }: PageProps) {
  const { id: incidentId } = use(params);
  const [state, setState] = useState<IncidentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbMode, setDbMode] = useState<'LIVE' | 'SIMULATED'>('LIVE');
  const [activeTab, setActiveTab] = useState<Tab>('facts');
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const pendingApprovals = state?.approvals.filter((a) => a.status === 'PENDING') ?? [];

  const calculateDuration = (createdStr: string) => {
    const diffMins = Math.floor((currentTime - new Date(createdStr).getTime()) / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
  };

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`);
      if (!res.ok) throw new Error('Not found');
      setState(await res.json());
      setDbMode('LIVE');
    } catch {
      setDbMode('SIMULATED');
      setState((prev) => prev ?? MOCK_STATE(incidentId));
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchState();
    const timer = setInterval(() => { fetchState(); setCurrentTime(Date.now()); }, 10000);
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

  const handleActionComplete = (actionId: string) => {
    if (!state) return;
    setState({ ...state, actions: state.actions.map((a) => a.id === actionId ? { ...a, status: 'COMPLETED' as const } : a) });
  };

  if (loading) {
    return (
      <div className="app-page flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-[#33d1ff] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-white/40">Loading incident...</span>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="app-page flex flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold">Incident not found</h2>
        <Link href="/incidents" className="text-[#33d1ff] text-sm hover:underline">Back to incidents</Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'facts', label: 'Facts', count: state.confirmedFacts.length },
    { id: 'hypotheses', label: 'Hypotheses', count: state.hypotheses.length },
    { id: 'conflicts', label: 'Conflicts', count: state.conflicts.length },
    { id: 'actions', label: 'Actions', count: state.actions.length },
    { id: 'approvals', label: 'Approvals', count: state.approvals.length },
    { id: 'timeline', label: 'Timeline', count: state.timeline.length },
  ];

  return (
    <div className="app-page font-sans flex flex-col pb-16">
      <AppHeader
        backHref="/incidents"
        backLabel="All incidents"
        title={state.title}
        subtitle={`${state.severity} · ${dbMode === 'LIVE' ? 'Live' : 'Demo mode'}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex p-1 rounded-full bg-white/5 border border-white/10 gap-0.5">
              {(['ACTIVE', 'RESOLVED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleUpdateStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${state.currentStatus === s
                      ? s === 'ACTIVE' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                      : 'text-white/50 hover:text-white'
                    }`}
                >
                  {s === 'ACTIVE' ? 'Active' : 'Resolved'}
                </button>
              ))}
            </div>
            <Link
              href={`/incidents/${incidentId}/room`}
              className="inline-flex items-center gap-2 bg-[#33d1ff] text-black text-sm font-semibold px-4 py-2 rounded-full hover:bg-[#33d1ff]/90 transition-all"
            >
              <Radio className="w-4 h-4" />
              <span className="hidden sm:inline">Voice room</span>
            </Link>
          </div>
        }
      />

      {pendingApprovals.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pt-4 w-full">
          <div className="app-alert app-alert-error rounded-2xl flex sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  {pendingApprovals.length} action{pendingApprovals.length > 1 ? 's' : ''} need your approval
                </p>
                <p className="text-xs opacity-70 mt-0.5">
                  {pendingApprovals.map((a) => a.actionTitle).join(' · ')}
                </p>
              </div>
            </div>
            <button onClick={() => setActiveTab('approvals')} className="btn-landing-primary text-xs shrink-0">
              Review now
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 w-full">
        {/* Left sidebar */}
        <section className="lg:col-span-4 space-y-4">
          <div className="landing-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="app-section-title flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Status
              </h2>
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-white/40">Status</p>
                <p className="font-semibold text-[#33d1ff] mt-0.5">{state.currentStatus}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-xs text-white/40">Duration</p>
                <p className="font-semibold text-green-400 mt-0.5">{calculateDuration(state.createdAt)}</p>
              </div>
            </div>
            {state.description && (
              <div className="p-3 rounded-xl bg-white/5 text-sm text-white/60 leading-relaxed">
                {state.description}
              </div>
            )}
          </div>

          <div className="landing-card p-5 space-y-4">
            <h2 className="app-section-title flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Team ({state.participants.length})
            </h2>
            <div className="space-y-2">
              {state.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#33d1ff] to-purple-500 flex items-center justify-center text-xs font-bold">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-white/40">{p.role}</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                </div>
              ))}
            </div>
          </div>

          <AISpeakerPanel incidentId={incidentId} enabled />
        </section>

        {/* Main content */}
        <section className="lg:col-span-8 space-y-4">
          <div className="app-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`app-tab ${activeTab === tab.id ? 'app-tab-active' : ''}`}
              >
                {tab.label} ({tab.count})
                {tab.id === 'approvals' && pendingApprovals.length > 0 && activeTab !== 'approvals' && (
                  <span className="ml-1.5 inline-flex w-4 h-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {pendingApprovals.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="landing-card p-6 space-y-4">
            {activeTab === 'facts' && (
              <>
                <h3 className="font-semibold text-lg">Confirmed facts</h3>
                <div className="space-y-3">
                  {state.confirmedFacts.map((fact) => (
                    <div key={fact.id} className="p-4 rounded-xl bg-white/5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{fact.title}</span>
                        <span className="badge-confirmed text-xs px-2 py-0.5 rounded-full">{fact.status}</span>
                      </div>
                      <p className="text-sm text-white/50">{fact.description}</p>
                      <p className="text-xs text-white/30">Source: {fact.evidence.sourceType}</p>
                    </div>
                  ))}
                  {state.confirmedFacts.length === 0 && (
                    <p className="text-sm text-white/40 text-center py-6">No confirmed facts yet.</p>
                  )}
                </div>
              </>
            )}

            {activeTab === 'hypotheses' && (
              <>
                <h3 className="font-semibold text-lg">Possible causes</h3>
                <div className="space-y-3">
                  {state.hypotheses.map((hyp) => (
                    <div key={hyp.id} className="p-4 rounded-xl bg-white/5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{hyp.title}</span>
                        <span className="badge-pending text-xs px-2 py-0.5 rounded-full">{hyp.status}</span>
                      </div>
                      <p className="text-sm text-white/50">{hyp.description}</p>
                      <p className="text-xs text-white/30">Reported by: {hyp.evidence.speakerId || 'Team'}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'conflicts' && (
              <>
                <h3 className="font-semibold text-lg">Disagreements</h3>
                <div className="space-y-3">
                  {state.conflicts.map((c) => (
                    <div key={c.id} className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-red-300">{c.topic}</span>
                        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Unresolved</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-black/30">
                          <p className="text-xs text-white/40 mb-1">Claim A</p>
                          {c.claimA}
                        </div>
                        <div className="p-3 rounded-lg bg-black/30">
                          <p className="text-xs text-white/40 mb-1">Claim B</p>
                          {c.claimB}
                        </div>
                      </div>
                    </div>
                  ))}
                  {state.conflicts.length === 0 && (
                    <p className="text-sm text-white/40 text-center py-6">No conflicts detected.</p>
                  )}
                </div>
              </>
            )}

            {activeTab === 'actions' && (
              <>
                <h3 className="font-semibold text-lg">Action items</h3>
                <div className="space-y-3">
                  {state.actions.map((act) => (
                    <div key={act.id} className="p-4 rounded-xl bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{act.title}</p>
                        <p className="text-sm text-white/50 mt-0.5">{act.description}</p>
                        <p className="text-xs text-white/30 mt-1">Assigned to: {act.assigneeName || 'Unassigned'}</p>
                      </div>
                      <button
                        onClick={() => handleActionComplete(act.id)}
                        disabled={act.status === 'COMPLETED'}
                        className="btn-landing-primary text-xs shrink-0 disabled:opacity-40"
                      >
                        {act.status === 'COMPLETED' ? 'Done' : 'Mark done'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'approvals' && (
              <>
                <h3 className="font-semibold text-lg flex items-center justify-between">
                  Approvals
                  {pendingApprovals.length > 0 && (
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{pendingApprovals.length} pending</span>
                  )}
                </h3>
                {state.approvals.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <ShieldCheck className="w-8 h-8 mx-auto text-green-400" />
                    <p className="text-sm text-white/50">No approvals needed right now.</p>
                    <p className="text-xs text-white/30">Critical actions will show up here for sign-off.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {state.approvals.map((approval) => (
                      <ApprovalCard key={approval.id} approval={approval} onResolved={() => fetchState()} />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'timeline' && (
              <>
                <h3 className="font-semibold text-lg">Event timeline</h3>
                <div className="space-y-2">
                  {state.timeline.map((evt, idx) => (
                    <div key={evt.id || idx} className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
                      <span className="w-2 h-2 rounded-full bg-[#33d1ff] mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-[#33d1ff]">{evt.eventType}</span>
                        <p className="text-sm text-white/70 mt-0.5">{evt.description}</p>
                      </div>
                      <span className="text-xs text-white/30 shrink-0">
                        {evt.eventTime ? new Date(evt.eventTime).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
