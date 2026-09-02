'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Plus, Trash2, Radio } from 'lucide-react';
import AppHeader from '@/components/landing/AppHeader';

export default function NewIncident() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<'SEV1' | 'SEV2' | 'SEV3' | 'SEV4'>('SEV3');
  const [description, setDescription] = useState('');
  const [commanderName, setCommanderName] = useState('');
  const [commanderEmail, setCommanderEmail] = useState('');
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
    setParticipants(participants.map((p, i) => (i === index ? { ...p, [key]: value } : p)));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      title,
      severity,
      description,
      commander: commanderName && commanderEmail ? { name: commanderName, email: commanderEmail } : undefined,
      participants: participants
        .filter((p) => p.name.trim() !== '')
        .map((p) => ({ name: p.name, role: p.role, email: p.email || undefined })),
    };

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create incident');
      }

      const incident = await res.json();
      router.push(`/incidents/${incident.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-page font-sans flex flex-col">
      <AppHeader backHref="/incidents" backLabel="All incidents" title="New incident" />

      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full space-y-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Start a voice bridge</p>
          <h1 className="text-3xl font-bold tracking-tight">Report an outage</h1>
          <p className="mt-2 text-white/50">
            Fill in the details below to open a live incident room with AI support.
          </p>
        </div>

        {error && (
          <div className="app-alert app-alert-error">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="landing-card p-6 sm:p-8 space-y-8">
          {/* Incident details */}
          <section className="space-y-4">
            <h2 className="app-section-title">Incident details</h2>

            <div>
              <label htmlFor="title" className="app-label">Title *</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Payment failures in checkout"
                className="app-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="severity" className="app-label">Severity *</label>
                <select
                  id="severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as typeof severity)}
                  className="app-input"
                >
                  <option value="SEV1">SEV1 — Critical</option>
                  <option value="SEV2">SEV2 — Major</option>
                  <option value="SEV3">SEV3 — Minor</option>
                  <option value="SEV4">SEV4 — Info</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="description" className="app-label">What happened?</label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Error rate spiked to 42% on checkout API"
                  className="app-input"
                />
              </div>
            </div>
          </section>

          {/* Commander */}
          <section className="space-y-4">
            <h2 className="app-section-title">Incident commander</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="commanderName" className="app-label">Name</label>
                <input
                  type="text"
                  id="commanderName"
                  value={commanderName}
                  onChange={(e) => setCommanderName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="app-input"
                />
              </div>
              <div>
                <label htmlFor="commanderEmail" className="app-label">Email</label>
                <input
                  type="email"
                  id="commanderEmail"
                  value={commanderEmail}
                  onChange={(e) => setCommanderEmail(e.target.value)}
                  placeholder="e.g. rahul@company.com"
                  className="app-input"
                />
              </div>
            </div>
          </section>

          {/* Participants */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="app-section-title">Team members</h2>
              <button
                type="button"
                onClick={addParticipantRow}
                className="btn-landing-outline text-xs py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5" />
                Add person
              </button>
            </div>

            {participants.length === 0 ? (
              <p className="text-sm text-white/40 p-4 rounded-xl bg-white/5 text-center">
                No team members added yet. You can invite people inside the live call too.
              </p>
            ) : (
              <div className="space-y-3">
                {participants.map((part, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded-xl bg-white/5">
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                        required
                        placeholder="Name"
                        className="app-input"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={part.role}
                        onChange={(e) => updateParticipant(index, 'role', e.target.value)}
                        className="app-input"
                      >
                        <option value="ENGINEER">Engineer</option>
                        <option value="SRE">SRE</option>
                        <option value="SUPPORT">Support</option>
                        <option value="PRODUCT">Product</option>
                        <option value="BUSINESS">Business</option>
                        <option value="OBSERVER">Observer</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="email"
                        value={part.email || ''}
                        onChange={(e) => updateParticipant(index, 'email', e.target.value)}
                        placeholder="Email (optional)"
                        className="app-input"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeParticipantRow(index)}
                        className="p-2 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-landing-primary justify-center py-3.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Starting incident...
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                Start incident
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
