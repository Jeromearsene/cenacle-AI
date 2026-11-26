import { MAX_URL_LENGTH, restorableUrl } from '../src/main/last-url';
import { parseState } from '../src/main/state';
import { evalIn, expect, test, waitForServices } from './fixtures';

const base = 'https://claude.ai/';

test.describe('address worth reopening', () => {
  test('a conversation of the same site is kept', () => {
    expect(restorableUrl('https://claude.ai/chat/abc-123', base)).toBe(
      'https://claude.ai/chat/abc-123'
    );
    expect(restorableUrl('https://claude.ai/chat/abc?x=1#frag', base)).toBe(
      'https://claude.ai/chat/abc?x=1'
    );
  });

  test('another site, another scheme, sign-in pages and junk are refused', () => {
    expect(restorableUrl('https://evil.example/chat/abc', base)).toBeNull();
    expect(restorableUrl('https://claude.ai.evil.example/chat/abc', base)).toBeNull();
    expect(restorableUrl('http://claude.ai/chat/abc', base)).toBeNull();
    expect(restorableUrl('file:///etc/passwd', base)).toBeNull();
    expect(restorableUrl('chrome-error://chromewebdata/', base)).toBeNull();
    expect(restorableUrl('https://claude.ai/login', base)).toBeNull();
    expect(restorableUrl('https://claude.ai/oauth/authorize', base)).toBeNull();
    expect(restorableUrl('pas une adresse', base)).toBeNull();
    expect(restorableUrl(undefined, base)).toBeNull();
    expect(restorableUrl(`https://claude.ai/${'a'.repeat(MAX_URL_LENGTH)}`, base)).toBeNull();
  });

  test('state.json keeps the address only when it has the right shape', () => {
    const account = (extra: Record<string, unknown>) => ({
      id: 'abcd1234',
      name: 'Claude 1',
      color: '#d97757',
      provider: 'claude',
      ...extra,
    });
    const parse = (extra: Record<string, unknown>) =>
      parseState({ accounts: [account(extra)] }).accounts[0]?.lastUrl;
    expect(parse({ lastUrl: 'https://claude.ai/chat/abc' })).toBe('https://claude.ai/chat/abc');
    expect(parse({})).toBeUndefined();
    expect(parse({ lastUrl: 42 })).toBeUndefined();
    expect(parse({ lastUrl: 'x'.repeat(MAX_URL_LENGTH + 1) })).toBeUndefined();
  });
});

test('reopens each account on its last conversation after a restart', async ({
  launch,
  service,
}) => {
  const origin = new URL(service.url).origin;
  const first = await launch();
  const [id] = await waitForServices(first.app, origin, 1);
  // A single-page app changes address without reloading; a sign-in page must not replace it.
  await evalIn(first.app, id as number, `history.pushState({}, '', '/chat/abc')`);
  await evalIn(first.app, id as number, `history.pushState({}, '', '/login')`);
  await first.app.close();

  const second = await launch();
  const [reopened] = await waitForServices(second.app, origin, 1);
  await expect
    .poll(() => evalIn<string>(second.app, reopened as number, 'location.pathname'))
    .toBe('/chat/abc');
});
