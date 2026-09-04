import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/incidents");
  }

  const { callbackUrl } = await searchParams;

  return (
    <div className="landing-bg min-h-screen flex flex-col">
      <header className="max-w-7xl w-full mx-auto px-6 h-16 flex items-center">
        <Link href="/" className="text-2xl font-black text-[#33d1ff] tracking-tight lowercase">
          agora voicebridge
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#33d1ff] to-purple-500 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-black" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-white/50 text-sm mt-2">
              Sign in to your incident command dashboard.
            </p>
          </div>

          <div className="landing-card rounded-2xl p-7">
            <LoginForm callbackUrl={callbackUrl} />
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-white/30">
        Agora VoiceBridge · Real-time AI voice intelligence for outage response
      </footer>
    </div>
  );
}
