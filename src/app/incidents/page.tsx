'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
  status: 'ACTIVE' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
}

export default function IncidentsList() {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-lg text-white">
              ⚡
            </Link>
            <span className="font-bold text-xl tracking-tight">AI Incident Commander</span>
          </div>
          <Link
            href="/incidents/new"
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow transition-all"
          >
            Declare Incident
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Operational Incidents</h1>
          <p className="text-slate-400 mt-1">Review currently active outages and resolved post-mortems.</p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-800/50 text-amber-300 text-sm">
            Note: Database connection failed. Showing simulated incidents for offline development.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {incidents.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="p-6 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 group"
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-extrabold px-2.5 py-0.5 rounded ${
                        incident.severity === 'SEV1'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800/80 animate-pulse'
                          : incident.severity === 'SEV2'
                          ? 'bg-orange-950 text-orange-300 border border-orange-850/80'
                          : incident.severity === 'SEV3'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800/85'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {incident.severity}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                        incident.status === 'ACTIVE'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                          : 'bg-slate-850 text-slate-400 border border-slate-700/60'
                      }`}
                    >
                      {incident.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      Declared: {new Date(incident.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {incident.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {incident.description || 'No description provided.'}
                  </p>
                </div>
                <div className="text-slate-500 group-hover:text-indigo-400 transition-colors hidden sm:block text-2xl font-bold">
                  →
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
