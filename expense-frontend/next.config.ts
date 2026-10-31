import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));

function resolveSessionAuthDir(appRootDir: string): string {
  const inApp = path.join(appRootDir, "session-auth-client");
  const sibling = path.join(appRootDir, "..", "session-auth-client");
  if (fs.existsSync(path.join(inApp, "constants.ts"))) return inApp;
  if (fs.existsSync(path.join(sibling, "constants.ts"))) return sibling;
  return sibling;
}

const sessionAuthDir = resolveSessionAuthDir(appDir);
const sessionAuthInApp = sessionAuthDir.startsWith(appDir + path.sep);
const turbopackRoot = sessionAuthInApp ? appDir : path.join(appDir, "..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: sessionAuthInApp ? undefined : path.join(appDir, ".."),
  turbopack: {
    root: turbopackRoot,
    resolveAlias: {
      "@session-auth": sessionAuthDir,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@session-auth": sessionAuthDir,
    };
    return config;
  },
};

export default nextConfig;
