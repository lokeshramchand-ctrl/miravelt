import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // "standalone" output is only for the self-hosted Docker image (see Dockerfile,
  // which runs `node server.js` from .next/standalone). Vercel's builder does its
  // own output tracing and expects the default build output; standalone mode
  // changes the .next directory layout and breaks Vercel's build (missing
  // .next/next-server.js.nft.json). Vercel sets VERCEL=1 during builds.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
