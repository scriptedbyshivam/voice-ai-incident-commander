'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowLeft } from 'lucide-react';

interface AppHeaderProps {
  backHref?: string;
  backLabel?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function AppHeader({ backHref, backLabel, title, subtitle, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/" className="text-xl font-bold text-[#33d1ff] tracking-tight lowercase shrink-0">
            commander
          </Link>

          {backHref && (
            <Link
              href={backHref}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              {backLabel || 'Back'}
            </Link>
          )}

          {(title || subtitle) && (
            <div className="hidden md:block border-l border-white/10 pl-4 min-w-0">
              {subtitle && (
                <p className="text-[10px] uppercase tracking-widest text-white/40 truncate">{subtitle}</p>
              )}
              {title && (
                <h1 className="text-sm font-semibold truncate">{title}</h1>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {actions}
          <Link
            href="/incidents/new"
            className="hidden sm:inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2 rounded-full hover:bg-white/90 transition-all"
          >
            <span className="w-4 h-4 rounded-full bg-black flex items-center justify-center">
              <ArrowUpRight className="w-2.5 h-2.5 text-white" />
            </span>
            New Incident
          </Link>
        </div>
      </div>
    </header>
  );
}
