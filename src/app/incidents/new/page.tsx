'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import { Zap, AlertTriangle, Plus, Trash2, ArrowLeft } from 'lucide-react';

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

  const inputClasses = `w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
    isDark
      ? 'bg-slate-950/80 border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-600 shadow-xs'
  }`;

  const labelClasses = `block text-xs font-bold uppercase tracking-wider ${
    isDark ? 'text-slate-400' : 'text-slate-600'
  }`;

  return (
    <div
      className={`min-h-screen font-sans pb-16 relative transition-colors duration-300 ${
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
              href="/incidents"
              className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Cancel</span>
            </Link>

            <div className={`h-5 w-[1px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Form */}
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2 text-center sm:text-left">
          <h1 className={`text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Declare Outage Incident
          </h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Initialize a live Incident command bridge, assign roles, and activate AI situational intelligence.
          </p>
        </div>

        {error && (
          <div
            className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
              isDark
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={`p-6 sm:p-8 rounded-2xl border backdrop-blur-sm space-y-8 shadow-xl transition-all duration-300 ${
            isDark
              ? 'bg-slate-900/70 border-slate-800/80'
              : 'bg-white border-slate-200/90 shadow-slate-200/60'
          }`}
        >
          {/* Section 1: Core Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
              <span>1. Incident Details</span>
            </h3>

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
                  Severity *
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
                  Brief Outage Description
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

          <hr className={`border-t ${isDark ? 'border-slate-800/80' : 'border-slate-150'}`} />

          {/* Section 2: Incident Commander */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
              <span>2. Incident Commander</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="commanderName" className={labelClasses}>
                  Commander Name
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

          <hr className={`border-t ${isDark ? 'border-slate-800/80' : 'border-slate-150'}`} />

          {/* Section 3: Initial Participants */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                <span>3. Bridge Participants</span>
              </h3>
              <button
                type="button"
                onClick={addParticipantRow}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 text-indigo-400 border-slate-700 hover:bg-slate-750'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Participant</span>
              </button>
            </div>

            {participants.length === 0 ? (
              <div
                className={`p-5 rounded-xl border text-center text-xs ${
                  isDark
                    ? 'bg-slate-950/50 border-slate-800/80 text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                No initial participants added. You can also invite teammates dynamically inside the live bridge.
              </div>
            ) : (
              <div className="space-y-3">
                {participants.map((part, index) => (
                  <div
                    key={index}
                    className={`grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded-xl border ${
                      isDark
                        ? 'bg-slate-950/60 border-slate-800'
                        : 'bg-slate-50 border-slate-200'
                    }`}
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
                        className="p-1.5 text-rose-500 hover:text-rose-600 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Declaring Outage...</span>
              </>
            ) : (
              <span>Initialize Commander Bridge</span>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
