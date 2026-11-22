import { DEFAULT_PROVIDER, isAuthHost, PROVIDERS, providerOf } from '../src/main/providers';
import { expect, test } from './fixtures';

// Garde-fou pour qui ajoute un service : ces vérifications ne lancent pas l'app.

test.describe('registre des services', () => {
  test('chaque entrée est valide et cohérente', () => {
    const entries = Object.entries(PROVIDERS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, p] of entries) {
      expect(p.id, `id de « ${key} »`).toBe(key);
      expect(key, 'identifiant en minuscules, sans espace').toMatch(/^[a-z][a-z0-9-]*$/);
      expect(p.label.trim(), `libellé de « ${key} »`).not.toBe('');
      expect(new URL(p.url).protocol, `URL de « ${key} » en https`).toBe('https:');
      expect(['clean', 'native']).toContain(p.ua);
      for (const host of p.authHosts ?? []) {
        expect(host, `authHosts de « ${key} » : un nom de domaine, sans chemin`).toMatch(
          /^[a-z0-9.-]+$/
        );
      }
    }
  });

  test('le service par défaut existe', () => {
    expect(PROVIDERS[DEFAULT_PROVIDER]).toBeDefined();
  });

  test('un identifiant inconnu retombe sur le service par défaut', () => {
    expect(providerOf('nexiste-pas').id).toBe(DEFAULT_PROVIDER);
    expect(providerOf(undefined).id).toBe(DEFAULT_PROVIDER);
  });

  test('hôtes de connexion : communs à tous, ou propres à un service', () => {
    const chatgpt = providerOf('chatgpt');
    const claude = providerOf('claude');
    expect(isAuthHost('accounts.google.com', claude)).toBe(true); // commun
    expect(isAuthHost('auth.openai.com', chatgpt)).toBe(true); // propre à ChatGPT
    expect(isAuthHost('auth.openai.com', claude)).toBe(false); // pas pour Claude
    expect(isAuthHost('sub.login.live.com', claude)).toBe(true); // sous-domaine
    expect(isAuthHost('evilaccounts.google.com', claude)).toBe(false); // pas un simple suffixe
  });
});
