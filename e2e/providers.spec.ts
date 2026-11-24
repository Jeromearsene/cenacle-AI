import { DEFAULT_PROVIDER, isAuthHost, PROVIDERS, providerOf } from '../src/main/providers';
import { expect, test } from './fixtures';

// Safety net for whoever adds a service: these checks do not launch the app.

test.describe('provider registry', () => {
  test('every entry is valid and consistent', () => {
    const entries = Object.entries(PROVIDERS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, p] of entries) {
      expect(p.id, `id of "${key}"`).toBe(key);
      expect(key, 'identifiant en minuscules, sans espace').toMatch(/^[a-z][a-z0-9-]*$/);
      expect(p.label.trim(), `label of "${key}"`).not.toBe('');
      expect(new URL(p.url).protocol, `URL of "${key}" is https`).toBe('https:');
      expect(['clean', 'native']).toContain(p.ua);
      for (const host of p.authHosts ?? []) {
        expect(host, `authHosts of "${key}": a domain name, without a path`).toMatch(
          /^[a-z0-9.-]+$/
        );
      }
    }
  });

  test('the default service exists', () => {
    expect(PROVIDERS[DEFAULT_PROVIDER]).toBeDefined();
  });

  test('an unknown id falls back to the default service', () => {
    expect(providerOf('nexiste-pas').id).toBe(DEFAULT_PROVIDER);
    expect(providerOf(undefined).id).toBe(DEFAULT_PROVIDER);
  });

  test('sign-in hosts: common to all, or specific to a service', () => {
    const chatgpt = providerOf('chatgpt');
    const claude = providerOf('claude');
    expect(isAuthHost('accounts.google.com', claude)).toBe(true); // commun
    expect(isAuthHost('auth.openai.com', chatgpt)).toBe(true); // specific to ChatGPT
    expect(isAuthHost('auth.openai.com', claude)).toBe(false); // not for Claude
    expect(isAuthHost('sub.login.live.com', claude)).toBe(true); // sous-domaine
    expect(isAuthHost('evilaccounts.google.com', claude)).toBe(false); // not a mere suffix
  });
});
