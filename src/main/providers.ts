// Services pris en charge. Pour en ajouter un, il suffit d'une entrée dans PROVIDERS
// (voir « Adding a service » dans le README).
//
// ua : identifiant de navigateur envoyé aux sites
//   'clean'  : sans « Electron/x » ni nom d'app, comme un Chrome standard
//              (passe mieux les contrôles anti-robots de type Cloudflare)
//   'native' : identifiant d'Electron laissé tel quel
//              (Google refuse la connexion avec l'identifiant « nettoyé »)
//
// authHosts (facultatif) : domaines de connexion propres au service, en plus des fournisseurs
// d'identité courants (Google, Microsoft, Apple) déjà connus de tous les services.

export interface Provider {
  id: string;
  label: string;
  url: string;
  ua: 'clean' | 'native';
  authHosts?: string[];
}

export const PROVIDERS: Record<string, Provider> = {
  claude: { id: 'claude', label: 'Claude', url: 'https://claude.ai/', ua: 'clean' },
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

/** Le service d'un compte ; un identifiant inconnu retombe sur le service par défaut. */
export const providerOf = (id: unknown): Provider =>
  (isProviderId(id) ? PROVIDERS[id] : undefined) ?? (PROVIDERS[DEFAULT_PROVIDER] as Provider);

// Fournisseurs d'identité courants : les popups qui s'y ouvrent restent dans l'app, dans la
// session du compte concerné, pour que la connexion aboutisse sur le bon compte.
const COMMON_AUTH_HOSTS = [
  'accounts.google.com',
  'accounts.youtube.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
];

/** Ce domaine est-il une page de connexion, pour ce service (ou en général) ? */
export function isAuthHost(hostname: string, provider?: Provider): boolean {
  const h = hostname.toLowerCase();
  return [...COMMON_AUTH_HOSTS, ...(provider?.authHosts ?? [])].some(
    (a) => h === a || h.endsWith(`.${a}`)
  );
}
