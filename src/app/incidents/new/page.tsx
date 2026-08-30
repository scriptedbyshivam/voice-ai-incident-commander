'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewIncident() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'>('SEV3');
  const [description, setDescription] = useState('');
  
  // Commander states
  const [commanderName, setCommanderName] = useState('');
  const [commanderEmail, setCommanderEmail] = useState('');

  // Dynamic participants list
  const [participants, setParticipants] = useState<Array<{ name: string; role: string; email?: string }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addParticipantRow = () => {
    setParticipants([...participants, { name: '', role: 'ENGINEER', email: '' }]);
  };

  const removeParticipantRow = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, key: string, value: string) => {
    setParticipants(
      participants.map((p, i) => (i === index ? { ...p, [key]: value } : p))
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Build the request payload
    const payload = {
      title,
      severity,
      description,
      commander: commanderName && commanderEmail ? {
        name: commanderName,
        email: commanderEmail
      } : undefined,
      participants: participants.filter(p => p.name.trim() !== '').map(p => ({
        name: p.name,
        role: p.role,
        email: p.email ? p.email : undefined
      }))
    };

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to declare incident');
      }

      const incident = await res.json();
      router.push(`/incidents/${incident.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 relative">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-indigo-650/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-lg text-white">
              ⚡
            </Link>
            <span className="font-bold text-xl tracking-tight">AI Incident Commander</span>
          </div>
          <Link href="/incidents" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
            Cancel
          </Link>
        </div>
      </header>

      {/* Main Form */}
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-3xl font-extrabold text-white">Declare Outage Incident</h1>
          <p className="text-slate-400">Initialize a live Incident command bridge, assign roles, and spin up AI assistance.</p>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm space-y-8 shadow-xl">
          
          {/* Section 1: Core Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">1. Incident details</h3>
            
            <div className="space-y-2">
              <label htmlFor="title" className="block text-xs font-semibold text-slate-400">
                Incident Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Payment failures spiking in checkout-service"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-white text-sm transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 space-y-2">
                <label htmlFor="severity" className="block text-xs font-semibold text-slate-400">
                  Severity *
                </label>
                <select
                  id="severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-white text-sm transition-colors"
                >
                  <option value="SEV1">SEV1 — Critical Outage</option>
                  <option value="SEV2">SEV2 — Major Degradation</option>
                  <option value="SEV3">SEV3 — Minor Intermittent</option>
                  <option value="SEV4">SEV4 — Informational</option>
                </select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <label htmlFor="description" className="block text-xs font-semibold text-slate-400">
                  Brief Outage Description
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Spike in failed 500 error checkout routes"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-white text-sm transition-colors"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800/80" />

          {/* Section 2: Incident Commander */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">2. Incident Commander</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="commanderName" className="block text-xs font-semibold text-slate-400">
                  Commander Name *
                </label>
                <input
                  type="text"
                  id="commanderName"
                  value={commanderName}
                  onChange={(e) => setCommanderName(e.target.value)}
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-white text-sm transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="commanderEmail" className="block text-xs font-semibold text-slate-400">
                  Commander Email *
                </label>
                <input
                  type="email"
                  id="commanderEmail"
                  value={commanderEmail}
                  onChange={(e) => setCommanderEmail(e.target.value)}
                  required
                  placeholder="e.g. rahul@company.com"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-white text-sm transition-colors"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-800/80" />

          {/* Section 3: Initial Participants */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">3. Initial Bridge Participants</h3>
              <button
                type="button"
                onClick={addParticipantRow}
                className="px-2.5 py-1 text-xs font-bold bg-slate-850 hover:bg-slate-800 text-indigo-400 rounded border border-slate-750 transition-all"
              >
                + Add Participant
              </button>
            </div>

            {participants.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-855 text-center text-xs text-slate-500">
                No initial participants added. You can add them dynamically during the bridge session.
              </div>
            ) : (
              <div className="space-y-3">
                {participants.map((part, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                        required
                        placeholder="Participant Name"
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={part.role}
                        onChange={(e) => updateParticipant(index, 'role', e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="ENGINEER">ENGINEER</option>
                        <option value="SRE">SRE</option>
                        <option value="SUPPORT">SUPPORT</option>
                        <option value="PRODUCT">PRODUCT</option>
                        <option value="BUSINESS">BUSINESS</option>
                        <option value="OBSERVER">OBSERVER</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="email"
                        value={part.email || ''}
                        onChange={(e) => updateParticipant(index, 'email', e.target.value)}
                        placeholder="Email (optional)"
                        className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeParticipantRow(index)}
                        className="text-rose-500 hover:text-rose-400 font-black text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 font-semibold text-white bg-indigo-600 hover:bg-indigo-550 disabled:bg-indigo-850 disabled:text-slate-400 rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Declaring Outage...
              </>
            ) : (
              'Initialize Commander Bridge'
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
