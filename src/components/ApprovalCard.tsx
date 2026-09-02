'use client';

import React, { useState } from 'react';
import { ApprovalRequestSummary, EvidenceMetadata } from '@/types/incident';
import { AlertTriangle, ShieldCheck, ShieldX, Clock, User, FileText } from 'lucide-react';

interface ApprovalCardProps {
  approval: ApprovalRequestSummary;
  onResolved: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'badge-pending',
  APPROVED: 'badge-confirmed',
  REJECTED: 'bg-red-500/15 text-red-400 border border-red-500/30',
  EXPIRED: 'bg-white/5 text-white/40 border border-white/10',
};

export function ApprovalCard({ approval, onResolved }: ApprovalCardProps) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState<'none' | 'approve' | 'reject'>('none');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const isPending = approval.status === 'PENDING';
  const dangerous = isDangerous(approval.actionTitle, approval.actionDetails);
  const evidence = approval.evidence as EvidenceMetadata | null;

  const act = async (verb: 'approve' | 'reject') => {
    setBusy(verb);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${approval.id}/${verb}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'Incident Commander',
          confirmationText: confirmation,
          reason: verb === 'reject' ? confirmation || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${verb}`);
      if (verb === 'approve' && data.execution) setResult(data.execution.output);
      onResolved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy('none');
    }
  };

  const confirmDisabled = dangerous && confirmation.trim() !== 'CONFIRM';

  return (
    <div className={`p-5 rounded-xl border space-y-3 ${
      isPending ? 'bg-red-500/5 border-red-500/30' : 'landing-card'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isPending ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-white/60'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-300">Needs your approval</p>
            <p className="text-xs text-white/50 truncate">{approval.actionTitle}</p>
          </div>
        </div>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[approval.status] || STATUS_STYLES.PENDING}`}>
          {approval.status}
        </span>
      </div>

      <div className="p-3 rounded-xl bg-white/5 space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <FileText className="w-3 h-3" />
          Action
        </div>
        <p className="text-sm font-medium">{approval.actionTitle}</p>
        <p className="text-xs text-white/50">{approval.actionDetails}</p>
      </div>

      <div className="p-3 rounded-xl bg-white/5">
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
          <User className="w-3 h-3" />
          Requested by
        </div>
        <p className="text-xs text-white/70">
          {approval.requestedBy}
          {evidence?.sourceText ? ` — "${evidence.sourceText}"` : ''}
        </p>
      </div>

      {evidence && (
        <div className="p-3 rounded-xl bg-white/5 text-xs text-white/50">
          Source: {evidence.sourceType} · Confidence: {(evidence.confidence * 100).toFixed(0)}% · {evidence.verificationStatus}
          {evidence.sourceText && <p className="italic mt-1 text-white/40">&ldquo;{evidence.sourceText}&rdquo;</p>}
        </div>
      )}

      {dangerous && isPending && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
          <ShieldX className="w-4 h-4 shrink-0 mt-0.5" />
          <span>This is a risky production change. It will not run automatically. Type CONFIRM to approve.</span>
        </div>
      )}

      {approval.status === 'APPROVED' && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Approved by {approval.approvedBy || 'unknown'} at {approval.approvedAt ? new Date(approval.approvedAt).toLocaleTimeString() : ''}
        </div>
      )}
      {approval.status === 'REJECTED' && (
        <div className="p-3 rounded-xl bg-red-500/10 text-xs text-red-300 flex items-center gap-2">
          <ShieldX className="w-4 h-4" />
          Rejected by {approval.rejectedBy || 'unknown'}. Action was not executed.
        </div>
      )}
      {approval.status === 'EXPIRED' && (
        <div className="p-3 rounded-xl bg-white/5 text-xs text-white/40 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Expired — never approved, never executed.
        </div>
      )}

      {result && (
        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-300">
          <p className="text-green-400 font-medium mb-1">Execution result</p>
          {result}
        </div>
      )}

      {isPending && (
        <div className="space-y-2">
          {dangerous && (
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Type CONFIRM to approve"
              className="app-input text-sm"
            />
          )}
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => act('approve')}
              disabled={busy !== 'none' || confirmDisabled}
              className="flex-1 btn-landing-primary justify-center text-sm py-2.5 disabled:opacity-40"
            >
              <ShieldCheck className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => act('reject')}
              disabled={busy !== 'none'}
              className="flex-1 btn-landing-outline justify-center text-sm py-2.5 text-red-400 border-red-500/30"
            >
              <ShieldX className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function isDangerous(title: string, details: string): boolean {
  const text = `${title} ${details}`.toLowerCase();
  return ['rollback', 'restart', 'reboot', 'disable', 'drop', 'terminate', 'failover', 'delete', 'shut down', 'scale', 'redeploy'].some((w) => text.includes(w));
}

export default ApprovalCard;
