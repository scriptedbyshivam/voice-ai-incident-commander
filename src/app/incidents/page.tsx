'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Plus, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
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
    SEV1: 'badge-sev1',
    SEV2: 'badge-sev2',
    SEV3: 'badge-sev3',
    SEV4: 'badge-sev4',
  }[severity];
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {severity}
    </span>
  );
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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setIncidents([
          {
            id: 'payment-api-outage-mock-id',
            title: 'Payment Gateway API Outage',
            description: 'Checkout failure rate is high across the EU cluster.',
            severity: 'SEV1',
            status: 'ACTIVE',
            createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
          },
          {
            id: 'auth-latency-mock-id',
            title: 'Authentication Latency Spike',
            description: 'Login requests taking over 2.5 seconds to complete.',
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

  const activeCount = incidents.filter((i) => i.status === 'ACTIVE').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  return (
    <div className="app-page font-sans flex flex-col">
      <AppHeader
        backHref="/"
        backLabel="Home"
        title="Incidents"
        subtitle="Dashboard"
        actions={
          <Link
            href="/incidents/new"
            className="sm:hidden inline-flex items-center gap-1.5 bg-white text-black text-sm font-semibold px-4 py-2 rounded-full"
          >
            <Plus className="w-4 h-4" />
            New
          </Link>
        }
      />

      <main className="max-w-7xl mx-auto px-6 py-10 flex-1 w-full space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Live dashboard</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Your incidents</h1>
            <p className="mt-2 text-white/50">
              See all active and past outages in one place.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="landing-card px-5 py-3 text-center">
              <p className="text-xs text-white/40 mb-0.5">Active</p>
              <p className="text-2xl font-bold text-[#33d1ff]">{activeCount}</p>
            </div>
            <div className="landing-card px-5 py-3 text-center">
              <p className="text-xs text-white/40 mb-0.5">Resolved</p>
              <p className="text-2xl font-bold text-green-400">{resolvedCount}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="app-alert app-alert-warning">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>Database offline — showing sample data.</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-2 border-[#33d1ff] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/40">Loading incidents...</span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="landing-card p-12 text-center space-y-4">
            <p className="text-white/50">No incidents yet.</p>
            <Link href="/incidents/new" className="btn-landing-primary inline-flex">
              Start your first incident
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => (
              <motion.div key={incident.id} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
                <Link
                  href={`/incidents/${incident.id}`}
                  className="landing-card landing-card-hover p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 group block"
                >
                  <div className="space-y-3 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <SevBadge severity={incident.severity} />
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          incident.status === 'ACTIVE' ? 'badge-active' : 'badge-resolved'
                        }`}
                      >
                        {incident.status === 'ACTIVE' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        )}
                        {incident.status}
                      </span>
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(incident.createdAt).toLocaleDateString()}{' '}
                        {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold group-hover:text-[#33d1ff] transition-colors">
                      {incident.title}
                    </h3>
                    <p className="text-sm text-white/50 leading-relaxed">
                      {incident.description || 'No description provided.'}
                    </p>
                  </div>

                  <span className="btn-landing-outline shrink-0 self-start sm:self-center text-sm">
                    Open
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
