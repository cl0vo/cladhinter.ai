import posthog, { type Properties } from 'posthog-js';

type AnalyticsProperties = Properties | Record<string, unknown>;

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY?.toString().trim() ?? '';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST?.toString().trim() ?? '';
const ANALYTICS_ENABLED = Boolean(POSTHOG_KEY);

let initialised = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function ensureInitialised(): boolean {
  if (!isBrowser() || !ANALYTICS_ENABLED) {
    return false;
  }

  if (!initialised) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST || undefined,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
    });
    initialised = true;
  }

  return initialised;
}

export function initAnalytics(): void {
  ensureInitialised();
}

export function captureEvent(event: string, properties?: AnalyticsProperties): void {
  if (!ensureInitialised()) {
    if (import.meta.env.DEV) {
      console.debug('[analytics]', event, properties ?? {});
    }
    return;
  }
  posthog.capture(event, properties);
}

export function identifyUser(userId: string, properties?: AnalyticsProperties): void {
  if (!ensureInitialised()) {
    return;
  }
  posthog.identify(userId, properties);
}

export function resetAnalytics(): void {
  if (!isBrowser() || !initialised) {
    return;
  }
  posthog.reset();
  initialised = false;
}
