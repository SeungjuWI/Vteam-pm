import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
    optimizePackageImports: ["@xyflow/react", "openai"],
  },
  images: {
    remotePatterns: [
      ...(supabaseHostname ? [{ protocol: "https" as const, hostname: supabaseHostname }] : []),
      { protocol: "https" as const, hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
