'use client';

import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

interface AppHeaderProps {
  backHref?: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function AppHeader({ backHref, backLabel, title, subtitle, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-[#090b10]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Section: Plain Text Logo & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="group shrink-0">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-[#33d1ff] lowercase group-hover:opacity-80 transition-opacity">
              agora voicebridge
            </span>
          </Link>

          {backHref && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-white/20 font-light">/</span>
              <Link
                href={backHref}
                className="flex items-center gap-1 text-xs font-medium text-white/60 hover:text-white transition-colors shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{backLabel || 'Back'}</span>
              </Link>
            </div>
          )}

          {title && (
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span className="text-white/20 font-light">/</span>
              <span className="text-xs font-bold text-white truncate max-w-xs">{title}</span>
            </div>
          )}
        </div>

        {/* Right Section: Single Action Group */}
        <div className="flex items-center gap-3 shrink-0">
          {actions ? (
            actions
          ) : (
            <Link
              href="/incidents/new"
              className="inline-flex items-center gap-1.5 bg-[#33d1ff] hover:bg-[#5ce0ff] text-black text-xs font-bold px-4 py-2 rounded-full transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Declare Incident</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
