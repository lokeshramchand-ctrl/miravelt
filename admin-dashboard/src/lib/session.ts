import "server-only";

import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";

import { getSessionOptions, type SessionData } from "./session-shared";

/** Read/write the session in a Server Component (read-only there), Server
 * Action, or Route Handler. src/proxy.ts uses the lower-level seal/unseal
 * helpers in session-shared.ts instead, since it doesn't have next/headers. */
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}
