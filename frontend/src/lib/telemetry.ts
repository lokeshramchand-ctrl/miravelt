import * as Application from 'expo-application';
import { Platform } from 'react-native';
import type { ClientEventPayload } from '../api/repositories';

/**
 * Product events and crash reports, sent to our own backend (POST /v1/events)
 * and nowhere else - no third-party analytics SDK (PROJECT_AUDIT.md F26).
 *
 * An event is a name and a few scalar properties. Never a merchant, an amount
 * someone paid, or any other statement content: this is about how the app is
 * used, not about the user's money.
 *
 * Events queue in memory and flush in small batches. Losing a batch (offline,
 * signed out, app killed) is acceptable; blocking or crashing the app to
 * deliver one is not, so every failure here is swallowed.
 */
type Properties = Record<string, string | number | boolean | null | undefined>;
type Sender = (events: ClientEventPayload[], appVersion: string | null, platform: string) => Promise<void>;

const MAX_QUEUE = 100;
const BATCH = 25;
const FLUSH_AFTER_MS = 5000;

let queue: ClientEventPayload[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sender: Sender | null = null;
let enabled: () => boolean = () => true;
let flushing = false;

/** Wired once at startup (app/_layout.tsx) so this module does not import the API layer. */
export function configureTelemetry(options: { send: Sender; isEnabled: () => boolean }): void {
  sender = options.send;
  enabled = options.isEnabled;
}

function clean(properties: Properties): ClientEventPayload['properties'] {
  const out: ClientEventPayload['properties'] = {};
  for (const [key, value] of Object.entries(properties).slice(0, 20)) {
    if (value === undefined) continue;
    out[key] = typeof value === 'string' ? value.slice(0, 300) : value;
  }
  return out;
}

export function track(name: string, properties: Properties = {}): void {
  if (!enabled()) return;
  queue.push({ name, occurred_at: new Date().toISOString(), properties: clean(properties) });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= BATCH) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), FLUSH_AFTER_MS);
}

/** A crash or caught error. The stack is kept (it is our own code); it is clipped server-side too. */
export function reportError(error: unknown, context: { screen?: string; fatal?: boolean } = {}): void {
  const e = error instanceof Error ? error : new Error(String(error));
  if (!enabled()) return;
  queue.push({
    name: 'client_error',
    occurred_at: new Date().toISOString(),
    properties: {
      message: e.message.slice(0, 300),
      stack: (e.stack ?? '').slice(0, 4000),
      screen: context.screen ?? null,
      fatal: context.fatal ?? false,
    },
  });
  void flush();
}

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (flushing || !sender || queue.length === 0) return;
  flushing = true;
  const batch = queue.slice(0, BATCH);
  queue = queue.slice(batch.length);
  try {
    await sender(batch, Application.nativeApplicationVersion ?? null, Platform.OS);
  } catch {
    // Dropped on purpose - see the module comment.
  } finally {
    flushing = false;
  }
}

/** Test seam. */
export function __resetTelemetryForTests(): void {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
  sender = null;
  enabled = () => true;
  flushing = false;
}

export function __queuedForTests(): ClientEventPayload[] {
  return queue;
}

let globalHandlerInstalled = false;

/** Reports uncaught JS errors, then hands them to React Native's own handler. */
export function installGlobalErrorHandler(): void {
  if (globalHandlerInstalled) return;
  globalHandlerInstalled = true;
  const utils = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void } }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    reportError(error, { fatal: Boolean(isFatal) });
    previous(error, isFatal);
  });
}
