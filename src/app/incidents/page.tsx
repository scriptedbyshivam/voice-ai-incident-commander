'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, ArrowRight, Clock, AlertTriangle, Search, Filter, Radio,
  CheckCircle2, Flame, ShieldAlert, Zap, FileText, RefreshCw, BarChart2
} from 'lucide-react';
import AppHeader from '@/components/landing/AppHeader';

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
  status: 'ACTIVE' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
}

function SevBadge({ severity }: { severity: Incident['severity'] }) {
  const cls = {
    SEV1: 'bg-red-500/20 text-red-400 border-red-500/30',
    SEV2: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    SEV3: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    SEV4: 'bg-white/10 text-white/60 border-white/10',
  }[severity];

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${cls}`}>
      {severity}
    </span>
  );
}

export default function IncidentsList() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED' | 'SEV1'>('ALL');

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/incidents');
      if (!res.ok) throw new Error('Failed to fetch incidents');
      const data = await res.json();
      setIncidents(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setIncidents([
        {
          id: 'payment-api-outage-mock-id',
          title: 'Payment Gateway API Outage',
          description: 'Checkout failure rate is currently at 42% on payment microservice cluster due to DB latency.',
          severity: 'SEV1',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        },
        {
          id: 'auth-latency-mock-id',
          title: 'Authentication Latency Spike',
          description: 'Login requests taking over 2.5 seconds to complete on US-East auth cluster.',
          severity: 'SEV2',
          status: 'RESOLVED',
          createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
        },
        {
          id: 'db-replica-lag-mock-id',
          title: 'PostgreSQL Read Replica Replication Lag',
          description: 'Read replica lag exceeded 45 seconds during morning traffic surge.',
          severity: 'SEV1',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const matchesSearch =
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (incident.description && incident.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'ACTIVE') return incident.status === 'ACTIVE';
      if (statusFilter === 'RESOLVED') return incident.status === 'RESOLVED';
      if (statusFilter === 'SEV1') return incident.severity === 'SEV1';

      return true;
    });
  }, [incidents, searchQuery, statusFilter]);

  const activeCount = incidents.filter((i) => i.status === 'ACTIVE').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;
  const sev1Count = incidents.filter((i) => i.severity === 'SEV1').length;

  return (
    <div className="landing-bg min-h-screen font-sans flex flex-col selection:bg-cyan-500 selection:text-black">
      <AppHeader
        backHref="/"
        backLabel="Home"
        title="Incident Dashboard"
        subtitle="Operations Center"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={fetchIncidents}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Refresh Incidents"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/incidents/new"
              className="inline-flex items-center gap-1.5 bg-[#33d1ff] hover:bg-[#5ce0ff] text-black text-xs font-bold px-4 py-2 rounded-full transition-all shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Declare Incident</span>
            </Link>
          </div>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {/* Header Title Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#33d1ff] font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Realtime Operational Intelligence</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Active Incident Bridge</h1>
            <p className="text-sm text-white/60">
              Monitor, triage, and join live AI voice bridges for critical system outages.
            </p>
          </div>

          <Link
            href="/incidents/new"
            className="btn-landing-primary py-3.5 px-6 font-bold text-sm shadow-xl inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Declare New Incident</span>
          </Link>
        </div>

        {/* Top 4 Stat KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="landing-card p-4 border border-white/10 bg-[#0d0f17] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Active Outages</p>
              <p className="text-2xl font-bold text-[#33d1ff] mt-0.5">{activeCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-[#33d1ff]">
              <Flame className="w-5 h-5" />
            </div>
          </div>

          <div className="landing-card p-4 border border-white/10 bg-[#0d0f17] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">Resolved</p>
              <p className="text-2xl font-bold text-green-400 mt-0.5">{resolvedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="landing-card p-4 border border-white/10 bg-[#0d0f17] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">SEV1 Critical</p>
              <p className="text-2xl font-bold text-red-400 mt-0.5">{sev1Count}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>

          <div className="landing-card p-4 border border-white/10 bg-[#0d0f17] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">AI Triage Speed</p>
              <p className="text-2xl font-bold text-purple-400 mt-0.5">4m 12s</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <BarChart2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Database Warning Alert (If offline / demo mode) */}
        {error && (
          <div className="app-alert app-alert-warning rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-200">
                Database offline — displaying pre-configured operational outage fixtures.
              </span>
            </div>
            <button onClick={fetchIncidents} className="text-xs font-semibold underline text-amber-400 hover:text-amber-300">
              Retry Connection
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="landing-card p-4 border border-white/10 bg-[#0d0f17] flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-[#33d1ff] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-white/40 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: `All (${incidents.length})` },
              { id: 'ACTIVE', label: `Active (${activeCount})` },
              { id: 'RESOLVED', label: `Resolved (${resolvedCount})` },
              { id: 'SEV1', label: `SEV1 (${sev1Count})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as typeof statusFilter)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === f.id
                    ? 'bg-white text-black shadow-md'
                    : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Incident Cards List Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-[#33d1ff] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/40 font-mono">Loading incident telemetry...</span>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="landing-card p-12 text-center space-y-4 border border-white/10 bg-[#0d0f17]">
            <p className="text-white/50 text-sm">No matching incidents found.</p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
              className="text-xs text-[#33d1ff] hover:underline"
            >
              Reset search filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredIncidents.map((incident) => (
                <motion.div
                  key={incident.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="landing-card landing-card-hover p-6 border border-white/10 bg-[#0d0f17] flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <SevBadge severity={incident.severity} />
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            incident.status === 'ACTIVE'
                              ? 'bg-green-500/15 border-green-500/30 text-green-400'
                              : 'bg-white/5 border-white/10 text-white/50'
                          }`}
                        >
                          {incident.status === 'ACTIVE' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          )}
                          {incident.status}
                        </span>
                        <span className="text-xs text-white/40 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-white group-hover:text-[#33d1ff] transition-colors leading-tight">
                        <Link href={`/incidents/${incident.id}`}>
                          {incident.title}
                        </Link>
                      </h3>

                      <p className="text-xs text-white/60 leading-relaxed max-w-3xl line-clamp-2">
                        {incident.description || 'No description logged.'}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <Link
                        href={`/incidents/${incident.id}/room`}
                        className="p-2.5 rounded-full bg-white/5 hover:bg-[#33d1ff]/20 text-white/70 hover:text-[#33d1ff] border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-medium"
                        title="Join Voice Room"
                      >
                        <Radio className="w-4 h-4 text-[#33d1ff]" />
                        <span className="hidden sm:inline">Voice Room</span>
                      </Link>

                      <Link
                        href={`/incidents/${incident.id}`}
                        className="btn-landing-primary text-xs py-2.5 px-5 font-bold flex items-center gap-1.5 shadow-md"
                      >
                        <span>Open Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
