import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Embedded Postgres is for local development only and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
