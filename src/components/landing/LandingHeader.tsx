"use client";

import Link from "next/link";
import { ArrowUpRight, LogOut, LayoutDashboard } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Incidents", href: "/incidents" },
  { label: "Support", href: "#support" },
];

export default function LandingHeader() {
  const { data: session, status } = useSession();
  const authed = status === "authenticated";

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black text-[#33d1ff] tracking-tight lowercase hover:opacity-80 transition-opacity">
          agora voicebridge
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/80 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {authed ? (
            <>
              <Link
                href="/incidents"
                className="hidden sm:inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
              >
                {session.user?.name || "Dashboard"}
              </Link>
              <Link
                href="/incidents"
                className="inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-white/90 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-white/80 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-white/90 transition-all hover:scale-[1.02]"
              >
                <span className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                  <ArrowUpRight className="w-3 h-3 text-white" />
                </span>
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
