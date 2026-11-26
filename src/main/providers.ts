// Supported services. To add one, a single entry in PROVIDERS is enough
// (see "Adding a service" in docs/services.md).
//
// ua: browser identifier sent to websites
//   'clean'  : without "Electron/x" or the app name, like a standard Chrome
//              (gets through anti-bot checks such as Cloudflare's more easily)
//   'native' : Electron's identifier left as is
//              (Google refuses sign-in with the "cleaned" identifier)
//
// usageBanner (optional): the service shows a usage-limit banner in its page that Cénacle can
// read (see quota.ts). Only Claude for now.
//
// authHosts (optional): sign-in domains specific to the service, in addition to the common
// identity providers (Google, Microsoft, Apple) already known to every service.

export interface Provider {
  id: string;
  label: string;
  url: string;
  ua: 'clean' | 'native';
  authHosts?: string[];
  usageBanner?: boolean;
}

export const PROVIDERS: Record<string, Provider> = {
  claude: {
    id: 'claude',
    label: 'Claude',
    url: 'https://claude.ai/',
    ua: 'clean',
    usageBanner: true,
  },
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chatgpt.com/',
    ua: 'clean',
    authHosts: ['auth.openai.com', 'auth0.openai.com'],
  },
  gemini: { id: 'gemini', label: 'Gemini', url: 'https://gemini.google.com/app', ua: 'native' },
};

export const DEFAULT_PROVIDER = 'claude';

export const isProviderId = (id: unknown): id is string =>
  typeof id === 'string' && Object.hasOwn(PROVIDERS, id);

/** The service of an account; an unknown id falls back to the default service. */
export const providerOf = (id: unknown): Provider =>
  (isProviderId(id) ? PROVIDERS[id] : undefined) ?? (PROVIDERS[DEFAULT_PROVIDER] as Provider);

// Common identity providers: popups opening there stay in the app, in the session of the
// matching account, so the sign-in ends up on the right account.
const COMMON_AUTH_HOSTS = [
  'accounts.google.com',
  'accounts.youtube.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
];

/** Is this domain a sign-in page, for this service (or in general)? */
export function isAuthHost(hostname: string, provider?: Provider): boolean {
  const h = hostname.toLowerCase();
  return [...COMMON_AUTH_HOSTS, ...(provider?.authHosts ?? [])].some(
    (a) => h === a || h.endsWith(`.${a}`)
  );
}
