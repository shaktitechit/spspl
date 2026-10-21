import fs from "node:fs";
import path from "node:path";

/** Docker image copy (`./session-auth-client`) or monorepo sibling (`../session-auth-client`). */
export function resolveSessionAuthDir(appRootDir: string): string {
  const inApp = path.join(appRootDir, "session-auth-client");
  const sibling = path.join(appRootDir, "..", "session-auth-client");
  if (fs.existsSync(path.join(inApp, "constants.ts"))) return inApp;
  if (fs.existsSync(path.join(sibling, "constants.ts"))) return sibling;
  return sibling;
}
