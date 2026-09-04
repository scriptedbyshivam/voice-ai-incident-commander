import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Agora Agents / token / Prisma / OpenAI clients are Node-only and must
  // NOT appear in server-side generated bundles. Keeping them external ensures
  // the API routes (agent invite, token, analyze) run in the Node.js runtime
  // on serverless hosts like Vercel.
  serverExternalPackages: [
    "agora-agents",
    "agora-token",
    "@prisma/client",
    "prisma",
    "openai",
  ],
};

export default nextConfig;
