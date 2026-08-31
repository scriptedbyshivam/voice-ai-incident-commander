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
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [transcriptInput, setTranscriptInput] = useState('');
  
  // Reference time for purity in duration/age calculations
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Interactive command states
  const verifierName = 'Incident Commander';
  const verificationNotes = 'Verified via command dashboard';
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceMetadata | null>(null);
  const [aiSpeechText, setAiSpeechText] = useState<string | null>(null);
  
  // AI Commander Mock Status State
  const [aiStatus, setAiStatus] = useState<'Listening' | 'Analyzing' | 'Speaking' | 'Waiting for input'>('Listening');

  // Local state for UI updates
  const [liveTranscripts, setLiveTranscripts] = useState<Array<{ id: string; speaker: string; text: string; time: string }>>([
    { id: '1', speaker: 'System Alert', text: 'checkout.payment.failure.rate > 40%', time: '23:30:10' },
    { id: '2', speaker: 'Priya (Support)', text: 'Failures are spiking on support lines. Clients are complaining of timeout errors.', time: '23:32:00' },
    { id: '3', speaker: 'Rahul (Engineer)', text: 'I am checking the query latencies on the database connections.', time: '23:35:15' },
    { id: '4', speaker: 'Amit (Business)', text: 'Internal DB read charts look normal on Grafana though. I do not see any spike there.', time: '23:38:00' }
  ]);
  const [approvals, setApprovals] = useState<Array<{ id: string; actionTitle: string; actionDetails: string; requestedBy: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }>>([
    {
      id: 'app-1',
      actionTitle: 'Database Connection Pool Restart',
      actionDetails: 'Force terminate active connections and restart db pool config.',
      requestedBy: 'AI Incident Commander (Recommendation)',
      status: 'PENDING'
    }
  ]);

  // Helper functions using currentTime to maintain render purity
  const calculateDuration = (createdAtStr?: string): string => {
    if (!createdAtStr || !currentTime) return '0m';
    const diffMs = currentTime - new Date(createdAtStr).getTime();
    if (diffMs < 0) return '0m';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m`;
  };

  const calculateAge = (createdAtStr?: string): string => {
    if (!createdAtStr || !currentTime) return '0m ago';
    const diffMs = currentTime - new Date(createdAtStr).getTime();
    if (diffMs < 0) return '0s ago';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins === 0) return 'just now';
    return `${diffMins}m ago`;
  };

  // Fetch Incident State from backend wrapped in useCallback
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`);
      if (!res.ok) throw new Error('Incident not found');
      const data = await res.json();
      setState(data);
      setDbMode('LIVE');
    } catch (err) {
      console.warn('Backend database call failed, using mock fallbacks. Error:', err);
      setDbMode('SIMULATED');
      
      // Fallback local mock state if DB is offline or not seeded
      setState((prev) => {
        if (prev) return prev;
        return {
          incidentId,
          title: 'Payment API Outage',
          description: 'Checkout failure rate is currently at 42% on payment microservice.',
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
              title: 'Checkout failure spike',
              description: 'Payment failure rate is currently at 42%',
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
              title: 'Support Timeout queues',
              description: 'Support backlog showing checkout gateway failures.',
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
              title: 'Release Regression',
              description: 'Recent deployment of payment-routing microservice may be contributing.',
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
              title: 'Deployment inspection',
              description: 'Team agreed to look at deployment docker logs.',
              decidedBy: 'Priya Patel',
              evidence: { sourceType: 'MANUAL_CONFIRMATION', timestamp: new Date().toISOString(), confidence: 1.0, verificationStatus: 'VERIFIED' },
              createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString()
            }
          ],
          actions: [
            {
              id: 'a-1',
              title: 'Investigate deployment logs',
              description: 'Analyze deployment docker logs for payment-routing microservice',
              status: 'PENDING',
              assigneeName: 'Rahul Sharma',
              assigneeId: 'p-1',
              evidence: {
                sourceType: 'MANUAL_CONFIRMATION',
                sourceText: 'Rahul volunteered to review docker logs on SSH session.',
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
          openQuestions: [
            {
              id: 'q-1',
              title: 'What was the exact release hash deployed at 23:30?',
              description: 'Checking Docker deployment tags for verification.',
              resolved: false,
              evidence: {
                sourceType: 'SLACK',
                timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                confidence: 1.0,
                verificationStatus: 'UNVERIFIED'
              },
              createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
              updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString()
            }
          ],
          unresolvedRisks: [
            'Conflict Topic: Database Performance Disagreement',
            'Open Question: What was the exact release hash deployed at 23:30?'
          ],
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
    const timeout = setTimeout(() => {
      fetchState();
    }, 0);

    // Set polling to refresh dashboard periodically
    const timer = setInterval(() => {
      fetchState();
      setCurrentTime(Date.now());
    }, 10000);

    return () => {
      clearTimeout(timeout);
      clearInterval(timer);
    };
  }, [incidentId, fetchState]);

  // Command handlers
  const handleUpdateStatus = async (newStatus: 'ACTIVE' | 'RESOLVED' | 'CLOSED') => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleVerifyFact = async (factId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/facts/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factId, verifierName, notes: verificationNotes }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error('Failed to verify fact:', err);
    }
  };

  const handleVerifyHypothesis = async (hypothesisId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/hypotheses/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hypothesisId, verifierName, notes: verificationNotes }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error('Failed to verify hypothesis:', err);
    }
  };

  const handleUpdateActionStatus = async (actionId: string, status: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/actions/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, status, changedBy: verifierName, notes: 'Updated from Dashboard' }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error('Failed to update action:', err);
    }
  };

  const handleResolveConflict = async (conflictId: string) => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/conflicts/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflictId, verifierName, notes: 'Metrics resolved via consensus dashboard check' }),
      });
      if (res.ok) {
        fetchState();
      }
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    }
  };

  const handleSimulateSpeech = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transcriptInput.trim()) return;

    const newSegment = {
      id: String(liveTranscripts.length + 1),
      speaker: 'You (Engineer)',
      text: transcriptInput,
      time: new Date().toTimeString().split(' ')[0]
    };

    setLiveTranscripts((prev) => [...prev, newSegment]);
    setTranscriptInput('');
    setAiStatus('Analyzing');

    // Simulate AI vocalizer response
    setTimeout(() => {
      setAiStatus('Speaking');
      if (newSegment.text.toLowerCase().includes('database') || newSegment.text.toLowerCase().includes('slow')) {
        setAiSpeechText('Conflict logged on Database metrics. Verify if connection latency has recovered.');
      } else {
        setAiSpeechText('State persistence update triggered.');
      }
      
      setTimeout(() => {
        setAiStatus('Listening');
      }, 3000);
    }, 2000);
  };

  const handleApprovalAction = (id: string, action: 'APPROVED' | 'REJECTED') => {
    setApprovals((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: action } : app))
    );

    if (state) {
      const description = `Critical Action: "${approvals.find(a => a.id === id)?.actionTitle}" was ${action.toLowerCase()} by Commander.`;
      setState((prev) => prev ? {
        ...prev,
        timeline: [
          ...prev.timeline,
          {
            id: `t-added-${Date.now()}`,
            eventType: 'DECISION',
            description,
            eventTime: new Date().toISOString(),
            evidence: { sourceType: 'MANUAL_CONFIRMATION', timestamp: '', confidence: 1.0, verificationStatus: 'VERIFIED' },
            createdAt: new Date().toISOString()
          }
        ]
      } : null);
    }
  };

  const triggerPostMortem = async () => {
    setAiStatus('Analyzing');
    try {
      const res = await fetch(`/api/incidents/${incidentId}/summary`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => prev ? { ...prev, latestSummary: data.summaryText } : null);
      }
    } catch (err) {
      console.error(err);
      // Fallback mock summary
      setState((prev) => prev ? {
        ...prev,
        latestSummary: 'Post-Mortem: Incident declared at 23:30 due to a spike in Checkout failures (42%). Support flagged a deployment regression. Engineering latency conflicts were reviewed. Bridge authorized rollback, restoring metrics by 00:05.'
      } : null);
    } finally {
      setAiStatus('Listening');
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <h2 className="text-2xl font-bold">Incident bridge not found.</h2>
        <Link href="/incidents" className="text-indigo-500 hover:underline">Return to Incident Hub</Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans pb-16 relative transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header Panel */}
      <header className={`border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-300 ${isDark ? 'border-slate-850 bg-slate-950/75' : 'border-slate-200/80 bg-white/80 shadow-xs'}`}>
        <div className="max-w-8xl mx-auto px-6 h-18 flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-4">
          <div className="flex items-center gap-4">
            <Link href="/incidents" className={`p-2 rounded text-xs font-semibold transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
              ← Hub
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>INCIDENT BRIDGE</span>
                <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                  {dbMode === 'LIVE' ? 'Database Connected' : 'Simulated Sandbox'}
                </span>
              </div>
              <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{state.title}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status pills */}
            <div className={`flex rounded-lg overflow-hidden border p-1 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-100'}`}>
              <button
                onClick={() => handleUpdateStatus('ACTIVE')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  state.currentStatus === 'ACTIVE'
                    ? 'bg-rose-600 text-white shadow shadow-rose-500/25'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ACTIVE OUTAGE
              </button>
              <button
                onClick={() => handleUpdateStatus('RESOLVED')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  state.currentStatus === 'RESOLVED'
                    ? 'bg-emerald-600 text-white shadow shadow-emerald-500/25'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                RESOLVED
              </button>
            </div>

            {/* Severity tag */}
            <span className={`px-3 py-1.5 rounded-lg text-xs font-black border ${
              state.severity === 'SEV1'
                ? isDark ? 'bg-rose-950/80 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200'
                : state.severity === 'SEV2'
                ? isDark ? 'bg-orange-950/80 text-orange-300 border-orange-800' : 'bg-orange-50 text-orange-700 border-orange-200'
                : isDark ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {state.severity}
            </span>

            <div className={`h-5 w-[1px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-8xl w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMN 1: LIVE INCIDENT STATE & RISKS (4 spans) */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* Section 1: Live Incident State Details */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              <span>⚡ Live Incident State</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-500 block font-bold text-[9px] uppercase">STATUS</span>
                <span className="text-white font-bold block mt-0.5">{state.currentStatus}</span>
              </div>
              <div className="p-3 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-500 block font-bold text-[9px] uppercase">DURATION</span>
                <span className="text-indigo-400 font-bold block mt-0.5">{calculateDuration(state.createdAt)}</span>
              </div>
              <div className="col-span-2 p-3 rounded bg-slate-950 border border-slate-850">
                <span className="text-slate-500 block font-bold text-[9px] uppercase">INCIDENT ID</span>
                <span className="text-slate-400 font-mono block mt-0.5 select-all text-[11px] overflow-hidden truncate">{state.incidentId}</span>
              </div>
            </div>
            {state.description && (
              <div className="p-3 rounded bg-slate-950/40 border border-slate-850 text-xs text-slate-300 leading-relaxed">
                <span className="text-slate-500 font-bold block text-[9px] uppercase mb-1">Bridge Scope</span>
                {state.description}
              </div>
            )}
            <Link
              href={`/incidents/${state.incidentId}/room`}
              className="w-full py-2.5 px-4 font-bold text-center text-white bg-indigo-650 hover:bg-indigo-600 rounded-lg shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 text-xs"
            >
              🎙️ Join Voice Room
            </Link>
          </div>

          {/* Section 12: AI Status */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-850 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
              <span>🤖 AI Incident Commander</span>
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            </h3>
            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-850">
              <span className="text-xs text-slate-500 font-bold">STATE:</span>
              <span className="text-xs text-white font-black bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-900">
                {aiStatus}
              </span>
            </div>
            <div className="flex gap-2 text-[10px] text-slate-400">
              <button onClick={() => setAiStatus('Listening')} className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700">Listen</button>
              <button onClick={() => setAiStatus('Analyzing')} className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700">Analyze</button>
              <button onClick={() => setAiStatus('Speaking')} className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700">Speak</button>
            </div>
          </div>

          {/* Section 9: Unresolved Risks */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800/80 space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-450 flex items-center justify-between">
              <span>⚠️ Unresolved Risks</span>
              <span className="text-xs px-2 py-0.5 bg-rose-950 text-rose-400 rounded-full font-normal">
                {state.unresolvedRisks.length}
              </span>
            </h2>
            {state.unresolvedRisks.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-850 text-center text-xs text-slate-500">
                No active unresolved risks.
              </div>
            ) : (
              <div className="space-y-2">
                {state.unresolvedRisks.map((risk, index) => (
                  <div key={index} className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 text-xs text-rose-200 leading-relaxed font-mono flex gap-2">
                    <span>⚡</span>
                    <span>{risk}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Confirmed Facts */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center justify-between">
              <span>✅ Confirmed Facts</span>
              <span className="text-xs px-2 py-0.5 bg-slate-850 text-slate-400 rounded-full font-normal">
                {state.confirmedFacts.length}
              </span>
            </h2>
            {state.confirmedFacts.map((fact) => (
              <div key={fact.id} className="p-4 rounded-xl bg-slate-900 border border-emerald-950 shadow-xl space-y-2 relative overflow-hidden group border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
                    CONFIRMED FACT
                  </span>
                  <button onClick={() => setSelectedEvidence(fact.evidence)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline">
                    Evidence
                  </button>
                </div>
                <h4 className="font-bold text-white text-sm">{fact.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{fact.description}</p>
                <div className="text-[9px] text-slate-500">Source Type: {fact.evidence.sourceType}</div>
              </div>
            ))}
          </div>

          {/* Section 3: Reported Observations */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center justify-between">
              <span>👁️ Reported Observations</span>
              <span className="text-xs px-2 py-0.5 bg-slate-850 text-slate-400 rounded-full font-normal">
                {state.reportedObservations.length}
              </span>
            </h2>
            {state.reportedObservations.map((obs) => (
              <div key={obs.id} className="p-4 rounded-xl bg-slate-900 border border-slate-850 space-y-3 border-l-4 border-l-slate-400">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-350">
                    REPORTED OBSERVATION
                  </span>
                  <button onClick={() => setSelectedEvidence(obs.evidence)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline">
                    Evidence
                  </button>
                </div>
                <h4 className="font-bold text-white text-sm">{obs.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{obs.description}</p>
                
                <div className="flex items-center justify-between pt-2 border-t border-slate-850/50">
                  <span className="text-[9px] text-slate-500">Source: {obs.evidence.sourceType}</span>
                  <button 
                    onClick={() => handleVerifyFact(obs.id)} 
                    className="px-2 py-0.5 text-[9px] font-bold bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-900 rounded"
                  >
                    Confirm Fact ✓
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Section 4: Hypotheses */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center justify-between">
              <span>💡 Hypotheses</span>
              <span className="text-xs px-2 py-0.5 bg-slate-850 text-slate-400 rounded-full font-normal">
                {state.hypotheses.length}
              </span>
            </h2>
            {state.hypotheses.map((hyp) => (
              <div key={hyp.id} className="p-4 rounded-xl bg-slate-900 border border-amber-950 space-y-3 border-l-4 border-l-amber-500">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-900/50">
                    HYPOTHESIS
                  </span>
                  <button onClick={() => setSelectedEvidence(hyp.evidence)} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline">
                    Evidence
                  </button>
                </div>
                <h4 className="font-bold text-white text-sm">{hyp.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{hyp.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-850/50">
                  <span className="text-[9px] text-slate-500">Source: {hyp.evidence.sourceType}</span>
                  {hyp.status !== 'CONFIRMED' && (
                    <button 
                      onClick={() => handleVerifyHypothesis(hyp.id)} 
                      className="px-2.5 py-0.5 text-[9px] font-bold bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-900 rounded"
                    >
                      Promote to Confirmed Fact ✓
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COLUMN 2: CONFLICTS, DECISIONS, QUESTIONS & BRIDGE (4 spans) */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* Section 7: Conflict Panel */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center justify-between">
              <span>⚔️ Operational Conflicts</span>
              <span className="text-xs px-2 py-0.5 bg-rose-950 text-rose-350 rounded-full font-normal">
                {state.conflicts.filter(c => c.status === 'UNRESOLVED').length} active
              </span>
            </h2>

            {state.conflicts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
                No unresolved conflicts
              </div>
            ) : (
              state.conflicts.map((conf) => (
                <div key={conf.id} className="p-5 rounded-2xl bg-slate-900 border border-rose-900/50 space-y-4 relative overflow-hidden border-l-4 border-l-rose-500">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded bg-rose-950 text-rose-450 border border-rose-900/60">
                      CONFLICT DETECTED
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">{conf.status}</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm">{conf.topic}</h4>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded bg-slate-950 border border-slate-850">
                      <span className="text-[9px] font-bold text-rose-450 block uppercase">Claim A</span>
                      <p className="text-slate-300 mt-1">{conf.claimA}</p>
                      <span className="text-[8px] text-slate-500 block mt-1">Source: {conf.sourceA.sourceType} {conf.sourceA.speakerId && `(${conf.sourceA.speakerId})`}</span>
                    </div>

                    <div className="p-3 rounded bg-slate-950 border border-slate-850">
                      <span className="text-[9px] font-bold text-rose-450 block uppercase">Claim B</span>
                      <p className="text-slate-300 mt-1">{conf.claimB}</p>
                      <span className="text-[8px] text-slate-500 block mt-1">Source: {conf.sourceB.sourceType} {conf.sourceB.speakerId && `(${conf.sourceB.speakerId})`}</span>
                    </div>
                  </div>

                  {conf.status === 'UNRESOLVED' && (
                    <button 
                      onClick={() => handleResolveConflict(conf.id)}
                      className="w-full py-2 bg-rose-900 hover:bg-rose-800 text-white font-bold text-xs rounded transition-all"
                    >
                      Mark Resolved via consensus
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Section 5: Decisions */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center justify-between">
              <span>⚖️ Team Decisions</span>
              <span className="text-xs px-2 py-0.5 bg-slate-850 text-slate-400 rounded-full font-normal">
                {state.decisions.length}
              </span>
            </h2>
            {state.decisions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-805 text-center text-xs text-slate-500">
                No decisions recorded yet.
              </div>
            ) : (
              state.decisions.map((dec) => (
                <div key={dec.id} className="p-4 rounded-xl bg-slate-900 border border-indigo-900/60 space-y-2 border-l-4 border-l-indigo-500">
                  <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900">
                    DECISION RECORDED
                  </span>
                  <h4 className="font-bold text-white text-sm">{dec.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{dec.description}</p>
                  <div className="text-[9px] text-slate-500">Decided By: {dec.decidedBy}</div>
                </div>
              ))
            )}
          </div>

          {/* Section 8: Open Questions */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center justify-between">
              <span>❓ Open Questions</span>
              <span className="text-xs px-2 py-0.5 bg-slate-850 text-slate-400 rounded-full font-normal">
                {state.openQuestions.filter(q => !q.resolved).length}
              </span>
            </h2>
            {state.openQuestions.map((q) => (
              <div key={q.id} className="p-4 rounded-xl bg-slate-900 border border-slate-850 space-y-2 relative border-l-4 border-l-amber-500">
                <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-amber-950/20 text-amber-300 border border-amber-900/40">
                  {q.resolved ? 'RESOLVED' : 'UNRESOLVED'}
                </span>
                <h4 className="font-bold text-white text-sm text-slate-200">{q.title}</h4>
                {q.description && <p className="text-xs text-slate-400">{q.description}</p>}
                <div className="text-[9px] text-slate-500">Raised: {calculateAge(q.createdAt)}</div>
              </div>
            ))}
          </div>

          {/* Dialogue voice simulation bridge */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col h-[400px] relative">
            <div className="absolute top-0 right-0 left-0 p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm rounded-t-2xl z-10 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Transcript Bridge</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto pt-16 pb-4 space-y-4 px-2 scrollbar-thin">
              {liveTranscripts.map((t) => (
                <div key={t.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span className="font-bold">{t.speaker}</span>
                    <span>{t.time}</span>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 text-xs text-slate-300 leading-relaxed font-mono">
                    {t.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSimulateSpeech} className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                placeholder="Simulate speaking on voice call..."
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-white placeholder-slate-650"
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold rounded-lg transition-all">
                Send
              </button>
            </form>
          </div>

          {aiSpeechText && (
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-850/80 shadow-lg space-y-3 animate-fade-in">
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                AI State Broadcast
              </h4>
              <p className="text-xs text-indigo-200 font-mono italic">
                &quot;{aiSpeechText}&quot;
              </p>
              <button onClick={() => setAiSpeechText(null)} className="text-[10px] text-indigo-400 hover:text-white block text-right w-full font-bold">
                Acknowledge
              </button>
            </div>
          )}
        </section>

        {/* COLUMN 3: ACTIONS, TIMELINE & PARTICIPANTS (4 spans) */}
        <section className="lg:col-span-4 space-y-6">
          
          {/* Section 6: Action Matrix */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white">Action Matrix</h2>
            {state.actions.map((action) => (
              <div key={action.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded ${
                    action.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-450 border border-emerald-900' :
                    action.status === 'BLOCKED' ? 'bg-rose-950 text-rose-350 border border-rose-900' :
                    action.status === 'IN_PROGRESS' ? 'bg-indigo-950 text-indigo-350 border border-indigo-900' :
                    'bg-slate-800 text-slate-350'
                  }`}>
                    {action.status}
                  </span>
                  
                  <span className="text-[9px] text-slate-500 font-bold">
                    Age: {calculateAge(action.createdAt)}
                  </span>
                </div>
                
                <h4 className="font-bold text-white text-sm">{action.title}</h4>
                <p className="text-xs text-slate-400">{action.description}</p>
                
                <div className="flex items-center justify-between pt-2 border-t border-slate-850">
                  <span className="text-xs text-slate-400 font-semibold">
                    Owner: {action.assigneeName || 'Unassigned'}
                  </span>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => handleUpdateActionStatus(action.id, 'IN_PROGRESS')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[9px] text-indigo-400 rounded"
                    >
                      Start
                    </button>
                    <button 
                      onClick={() => handleUpdateActionStatus(action.id, 'BLOCKED')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[9px] text-rose-450 rounded"
                    >
                      Block
                    </button>
                    <button 
                      onClick={() => handleUpdateActionStatus(action.id, 'COMPLETED')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[9px] text-emerald-400 rounded"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pending Approvals drawer */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center justify-between">
              <span>Human Approvals Drawer</span>
              <span className="text-xs px-2 py-0.5 bg-indigo-950 text-indigo-350 rounded-full font-normal">
                {approvals.filter(a => a.status === 'PENDING').length} request
              </span>
            </h2>
            {approvals.map((req) => (
              <div key={req.id} className="p-4 rounded-xl border bg-slate-900 border-indigo-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase font-black text-indigo-400">CRITICAL OPERATION</span>
                  <span className="text-[9px] uppercase font-bold text-slate-500">{req.status}</span>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{req.actionTitle}</h4>
                  <p className="text-xs text-slate-405 leading-relaxed mt-1">{req.actionDetails}</p>
                </div>
                {req.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button onClick={() => handleApprovalAction(req.id, 'APPROVED')} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded transition-all">
                      Authorize Action
                    </button>
                    <button onClick={() => handleApprovalAction(req.id, 'REJECTED')} className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded transition-all">
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Section 10: Timeline */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center justify-between">
              <span>📅 Chronological Timeline</span>
            </h3>
            
            <button onClick={triggerPostMortem} className="w-full py-2 bg-indigo-650 hover:bg-indigo-650 text-xs font-semibold text-white rounded transition-all">
              Generate Post-Mortem Report
            </button>

            {state.latestSummary && (
              <div className="p-3.5 rounded bg-slate-950 border border-slate-850 font-mono text-[10px] text-slate-300 leading-relaxed whitespace-pre-line">
                {state.latestSummary}
              </div>
            )}

            <div className="pt-2 space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {state.timeline.map((ev) => (
                <div key={ev.id} className="relative pl-8 space-y-1">
                  <div className="absolute left-[7px] top-[5px] w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-slate-950 border border-slate-900" />
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                    <span>{ev.eventType}</span>
                    <span>{new Date(ev.eventTime).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-xs text-slate-350 leading-normal">{ev.description}</p>
                  {ev.evidence && (
                    <div className="text-[9px] text-slate-500 italic">
                      Source: {ev.evidence.sourceType} {ev.evidence.speakerId ? `(${ev.evidence.speakerId})` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 11: Participants */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400">👥 Bridge Participants</h3>
            <div className="space-y-2">
              {state.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-850 text-xs">
                  <div>
                    <span className="font-bold text-white">{p.name}</span>
                    <span className="text-[9px] font-black text-slate-500 block">JOINED: {new Date(p.joinedAt).toLocaleTimeString()}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-350 font-bold uppercase text-[9px]">
                    {p.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* EVIDENCE OVERLAY DRAWER */}
      {selectedEvidence && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Evidence Audit Trace</h3>
              <button onClick={() => setSelectedEvidence(null)} className="text-slate-400 hover:text-white font-bold text-lg">✕</button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-850">
                  <span className="text-slate-500 block font-bold text-[9px] uppercase">SOURCE TYPE</span>
                  <span className="text-indigo-450 font-mono font-bold mt-0.5 block">{selectedEvidence.sourceType}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-850">
                  <span className="text-slate-500 block font-bold text-[9px] uppercase">CONFIDENCE</span>
                  <span className="text-emerald-400 font-bold mt-0.5 block">{(selectedEvidence.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              {selectedEvidence.sourceText && (
                <div className="p-3.5 rounded bg-slate-950 border border-slate-850">
                  <span className="text-slate-500 block font-bold text-[9px] uppercase mb-1.5">Original Transcript/Alert Text</span>
                  <p className="text-xs text-slate-300 italic font-mono leading-relaxed">
                    &quot;{selectedEvidence.sourceText}&quot;
                  </p>
                </div>
              )}

              <div className="text-[10px] text-slate-500 space-y-1">
                <div>Source timestamp: {new Date(selectedEvidence.timestamp).toLocaleString()}</div>
                <div>Status: <span className="font-bold uppercase text-indigo-450">{selectedEvidence.verificationStatus}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
