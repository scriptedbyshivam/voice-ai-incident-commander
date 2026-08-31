'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import { Zap, Plus, ArrowRight, Activity, AlertCircle, Clock, ShieldAlert } from 'lucide-react';

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
        // Load fallback mock data for offline development
        setIncidents([
          {
            id: 'payment-api-outage-mock-id',
            title: 'Payment API Outage',
            description: 'Spike in checkout and credit card processing failure rates.',
            severity: 'SEV1',
            status: 'ACTIVE',
            createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
          },
          {
            id: 'auth-latency-mock-id',
            title: 'User Authentication Latency spike',
            description: 'Cognito integration reports latency > 2.5s on login request.',
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
      className={`min-h-screen font-sans pb-16 transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Header */}
      <header
        className={`border-b backdrop-blur-md sticky top-0 z-50 transition-colors duration-300 ${
          isDark
            ? 'border-slate-800/80 bg-slate-950/75'
            : 'border-slate-200/80 bg-white/75 shadow-xs'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/25"
            >
              <Zap className="w-4 h-4 fill-white text-white" />
            </Link>
            <span
              className={`font-bold text-xl tracking-tight bg-clip-text text-transparent ${
                isDark
                  ? 'bg-gradient-to-r from-white via-slate-100 to-slate-300'
                  : 'bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950'
              }`}
            >
              AI Incident Commander
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/incidents/new"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Declare Incident</span>
            </Link>

            <div className={`h-5 w-[1px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className={`text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Operational Incidents
            </h1>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Real-time situational dashboard for live outages and resolved post-mortems.
            </p>
          </div>
        </div>

        {error && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
              isDark
                ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Note: Database connection fallback mode active. Showing simulated incidents.</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {incidents.map((incident) => {
              const isSev1 = incident.severity === 'SEV1';
              const isSev2 = incident.severity === 'SEV2';
              const isSev3 = incident.severity === 'SEV3';

              return (
                <motion.div
                  key={incident.id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Link
                    href={`/incidents/${incident.id}`}
                    className={`p-6 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 group block ${
                      isDark
                        ? 'bg-slate-900/60 border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900/90 shadow-xl'
                        : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-lg shadow-sm'
                    }`}
                  >
                    <div className="space-y-2.5 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md border ${
                            isSev1
                              ? isDark
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800/80 animate-pulse'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                              : isSev2
                              ? isDark
                                ? 'bg-orange-950/80 text-orange-300 border-orange-800/80'
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                              : isSev3
                              ? isDark
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                              : isDark
                              ? 'bg-slate-800 text-slate-300 border-slate-700'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {incident.severity}
                        </span>

                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                            incident.status === 'ACTIVE'
                              ? isDark
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isDark
                              ? 'bg-slate-800 text-slate-400 border-slate-700'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {incident.status}
                        </span>

                        <span className={`text-xs flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          <Clock className="w-3.5 h-3.5" />
                          Declared: {new Date(incident.createdAt).toLocaleDateString()} at {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <h3
                        className={`text-xl font-bold transition-colors ${
                          isDark
                            ? 'text-white group-hover:text-indigo-400'
                            : 'text-slate-900 group-hover:text-indigo-600'
                        }`}
                      >
                        {incident.title}
                      </h3>

                      <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {incident.description || 'No description provided.'}
                      </p>
                    </div>

                    <div
                      className={`transition-colors shrink-0 flex items-center gap-1 font-semibold text-sm ${
                        isDark
                          ? 'text-indigo-400 group-hover:translate-x-1'
                          : 'text-indigo-600 group-hover:translate-x-1'
                      }`}
                    >
                      <span className="hidden sm:inline">Open Hub</span>
                      <ArrowRight className="w-5 h-5 transition-transform" />
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
