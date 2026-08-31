'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import { Zap, Plus, ArrowRight, Activity, AlertCircle, Clock, ShieldAlert, Radio, AlertTriangle } from 'lucide-react';

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
  status: 'ACTIVE' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
}

export default function IncidentsList() {
  const { isDark } = useTheme();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIncidents() {
      try {
        const res = await fetch('/api/incidents');
        if (!res.ok) throw new Error('Failed to fetch incidents');
        const data = await res.json();
        setIncidents(data);
      } catch (err: any) {
        setError(err.message);
        // Fallback simulated incidents for offline development
        setIncidents([
          {
            id: 'payment-api-outage-mock-id',
            title: 'Payment Gateway API Outage',
            description: 'Spike in checkout and credit card processing failure rates across EU-Central cluster.',
            severity: 'SEV1',
            status: 'ACTIVE',
            createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
          },
          {
            id: 'auth-latency-mock-id',
            title: 'Cognito Authentication Latency Spike',
            description: 'User authentication integration reports latency > 2.5s on OAuth login request handler.',
            severity: 'SEV2',
            status: 'RESOLVED',
            createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchIncidents();
  }, []);

  return (
    <div
      className={`min-h-screen font-sans pb-16 transition-colors duration-300 flex flex-col ${
        isDark ? 'bg-[#141720] text-[#f1f5f9]' : 'bg-[#e0e5ec] text-[#2d3436]'
      }`}
    >
      {/* Industrial Machine Header */}
      <header className="sticky top-0 z-40 px-6 py-4">
        <div
          className={`max-w-7xl mx-auto px-6 h-16 rounded-2xl flex items-center justify-between border transition-all duration-300 shadow-industrial-card ${
            isDark ? 'bg-[#1b202c]/90 border-[#232a3a]' : 'bg-[#f0f2f5]/90 border-white/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-[#ff4757] text-white flex items-center justify-center font-bold shadow-industrial-accent active:translate-y-0.5"
            >
              <Zap className="w-5 h-5 fill-white" />
            </Link>
            <div>
              <span className="font-extrabold text-base tracking-tight font-sans embossed-text block leading-none">
                Incident Control Center
              </span>
              <span className="text-[9px] font-mono text-[#4a5568] dark:text-[#94a3b8] uppercase font-bold">
                TELEMETRY DISPATCH DECK
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/incidents/new"
              className="btn-mechanical-primary px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Declare Outage</span>
            </Link>

            <div className="h-6 w-1 rounded-full bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed" />

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Operations Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 flex-1 w-full">
        {/* Title Deck */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 led-glow-green animate-pulse" />
              <span>LIVE INCIDENT REGISTRY // CLUSTER US-EAST</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight embossed-text font-sans">
              Operational Incidents
            </h1>
            <p className="mt-1 text-sm text-[#4a5568] dark:text-[#94a3b8] font-medium">
              Real-time situational dashboard for live outages and resolved post-mortems.
            </p>
          </div>

          {/* Quick Metrics Cartridge */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-[#d1d9e6]/60 dark:bg-[#0e1017]/60 shadow-industrial-recessed font-mono text-center">
              <div className="text-[9px] uppercase font-bold text-slate-500">ACTIVE</div>
              <div className="text-lg font-black text-[#ff4757] mt-0.5">
                {incidents.filter((i) => i.status === 'ACTIVE').length}
              </div>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-[#d1d9e6]/60 dark:bg-[#0e1017]/60 shadow-industrial-recessed font-mono text-center">
              <div className="text-[9px] uppercase font-bold text-slate-500">RESOLVED</div>
              <div className="text-lg font-black text-emerald-500 mt-0.5">
                {incidents.filter((i) => i.status === 'RESOLVED').length}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs font-mono flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Database offline fallback mode active. Showing simulated incident records.</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-[#ff4757] border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs text-slate-500 uppercase tracking-widest font-bold">
              POLLING INCIDENT BUS...
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {incidents.map((incident) => {
              const isSev1 = incident.severity === 'SEV1';
              const isSev2 = incident.severity === 'SEV2';
              const isActive = incident.status === 'ACTIVE';

              return (
                <motion.div
                  key={incident.id}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.18 }}
                >
                  <Link
                    href={`/incidents/${incident.id}`}
                    className={`p-6 sm:p-7 rounded-3xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 group block shadow-industrial-card hover:shadow-industrial-floating corner-screws ${
                      isDark
                        ? 'bg-[#1b202c] border-[#232a3a]'
                        : 'bg-[#f0f2f5] border-white'
                    }`}
                  >
                    <div className="space-y-3 max-w-3xl">
                      {/* Hardware Badges Row */}
                      <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
                        {/* Stamped SEV Metal Plate */}
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wider ${
                            isSev1
                              ? 'bg-[#ff4757] text-white shadow-industrial-accent'
                              : isSev2
                              ? 'bg-amber-500 text-white shadow-md'
                              : 'bg-[#d1d9e6] dark:bg-[#0e1017] text-slate-700 dark:text-slate-300 shadow-industrial-recessed'
                          }`}
                        >
                          {incident.severity}
                        </span>

                        {/* Status Beacon */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-400 led-glow-green animate-pulse' : 'bg-slate-500'
                            }`}
                          />
                          {incident.status}
                        </span>

                        <span className="text-[11px] text-[#4a5568] dark:text-[#94a3b8] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(incident.createdAt).toLocaleDateString()} // {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Incident Title */}
                      <h3 className="text-xl sm:text-2xl font-bold font-sans tracking-tight group-hover:text-[#ff4757] transition-colors">
                        {incident.title}
                      </h3>

                      {/* Incident Description */}
                      <p className="text-sm text-[#4a5568] dark:text-[#94a3b8] leading-relaxed">
                        {incident.description || 'No outage description provided.'}
                      </p>
                    </div>

                    {/* Launch Hub Key */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="btn-mechanical-chassis px-5 py-3 rounded-2xl font-mono text-xs font-bold uppercase tracking-wider group-hover:text-[#ff4757] flex items-center gap-2 border border-white/40 dark:border-white/5">
                        <span>Command Hub</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
