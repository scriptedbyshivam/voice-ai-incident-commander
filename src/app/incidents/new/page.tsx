'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import { Zap, AlertTriangle, Plus, Trash2, ArrowLeft, Radio, Terminal } from 'lucide-react';

export default function NewIncident() {
  const router = useRouter();
  const { isDark } = useTheme();
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

    const payload = {
      title,
      severity,
      description,
      commander:
        commanderName && commanderEmail
          ? {
              name: commanderName,
              email: commanderEmail,
            }
          : undefined,
      participants: participants
        .filter((p) => p.name.trim() !== '')
        .map((p) => ({
          name: p.name,
          role: p.role,
          email: p.email ? p.email : undefined,
        })),
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

  const inputClasses = `w-full px-4 py-3 rounded-xl input-data-slot text-xs font-mono transition-all ${
    isDark ? 'bg-[#0e1017] text-white placeholder-slate-600' : 'bg-[#d1d9e6] text-[#2d3436] placeholder-slate-500'
  }`;

  const labelClasses = 'block text-[10px] font-mono font-bold uppercase tracking-wider text-[#4a5568] dark:text-[#94a3b8]';

  return (
    <div
      className={`min-h-screen font-sans pb-16 transition-colors duration-300 flex flex-col ${
        isDark ? 'bg-[#141720] text-[#f1f5f9]' : 'bg-[#e0e5ec] text-[#2d3436]'
      }`}
    >
      {/* Header */}
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
                AI Incident Commander
              </span>
              <span className="text-[9px] font-mono text-[#4a5568] dark:text-[#94a3b8] uppercase font-bold">
                INCIDENT COMMISSIONING DECK
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/incidents"
              className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-2 rounded-xl transition-colors hover:text-[#ff4757] flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Cancel</span>
            </Link>

            <div className="h-6 w-1 rounded-full bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed" />

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Form Deck */}
      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8 flex-1 w-full">
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#d1d9e6] dark:bg-[#0e1017] shadow-industrial-recessed text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-[#ff4757] led-glow-red animate-pulse" />
            <span>DISPATCH PROTOCOL // SEV TRIAGE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight embossed-text font-sans">
            Declare Outage Incident
          </h1>
          <p className="text-sm text-[#4a5568] dark:text-[#94a3b8] font-medium">
            Initialize an operational voice command bridge, assign roles, and activate autonomous AI situational extraction.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs font-mono flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`p-6 sm:p-8 rounded-3xl border space-y-8 transition-all duration-300 shadow-industrial-card corner-screws ${
            isDark ? 'bg-[#1b202c] border-[#232a3a]' : 'bg-[#f0f2f5] border-white'
          }`}
        >
          {/* Section 1: Core Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-2">
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] flex items-center gap-1.5">
                <span>01 // INCIDENT SCOPE &amp; SEVERITY</span>
              </h3>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="title" className={labelClasses}>
                Incident Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Payment failures spiking in checkout-service"
                className={inputClasses}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1 space-y-1.5">
                <label htmlFor="severity" className={labelClasses}>
                  Severity Level *
                </label>
                <select
                  id="severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className={inputClasses}
                >
                  <option value="SEV1">SEV1 — Critical Outage</option>
                  <option value="SEV2">SEV2 — Major Degradation</option>
                  <option value="SEV3">SEV3 — Minor Intermittent</option>
                  <option value="SEV4">SEV4 — Informational</option>
                </select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="description" className={labelClasses}>
                  Telemetry / Impact Summary
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Spike in failed 500 error checkout routes"
                  className={inputClasses}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Incident Commander */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-2">
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] flex items-center gap-1.5">
                <span>02 // INCIDENT COMMANDER</span>
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="commanderName" className={labelClasses}>
                  Commander Full Name
                </label>
                <input
                  type="text"
                  id="commanderName"
                  value={commanderName}
                  onChange={(e) => setCommanderName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className={inputClasses}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="commanderEmail" className={labelClasses}>
                  Commander Email
                </label>
                <input
                  type="email"
                  id="commanderEmail"
                  value={commanderEmail}
                  onChange={(e) => setCommanderEmail(e.target.value)}
                  placeholder="e.g. rahul@company.com"
                  className={inputClasses}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Initial Participants */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-2">
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-widest text-[#ff4757] flex items-center gap-1.5">
                <span>03 // BRIDGE PARTICIPANTS</span>
              </h3>
              <button
                type="button"
                onClick={addParticipantRow}
                className="btn-mechanical-chassis px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Participant</span>
              </button>
            </div>

            {participants.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#d1d9e6]/40 dark:bg-[#0e1017]/50 shadow-industrial-recessed text-center text-xs font-mono text-[#4a5568] dark:text-[#94a3b8]">
                No initial participants added. You can also invite teammates dynamically inside the live bridge.
              </div>
            ) : (
              <div className="space-y-3">
                {participants.map((part, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded-2xl bg-[#d1d9e6]/40 dark:bg-[#0e1017]/50 shadow-industrial-recessed"
                  >
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                        required
                        placeholder="Participant Name"
                        className={inputClasses}
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={part.role}
                        onChange={(e) => updateParticipant(index, 'role', e.target.value)}
                        className={inputClasses}
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
                        className={inputClasses}
                      />
                    </div>
                    <div className="sm:col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeParticipantRow(index)}
                        className="p-2 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remove participant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tactile Emergency Trigger Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 btn-mechanical-primary rounded-2xl font-mono font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-industrial-accent active:translate-y-0.5"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>COMMISSIONING COMMAND BRIDGE...</span>
              </>
            ) : (
              <>
                <Radio className="w-4 h-4" />
                <span>INITIALIZE COMMANDER BRIDGE</span>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
