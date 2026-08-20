import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack's resolver and file watcher scoped to this application.
  // A separate lockfile exists higher in the home directory, so automatic
  // root detection would otherwise scan well beyond this repository.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
