import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模块，必须保持外部化（不打进 server bundle），
  // 否则原生 .node 的 require 会被破坏 → Could not locate the bindings file
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
