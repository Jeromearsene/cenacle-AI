# Services

**English** · [Français](fr/services.md)

← [Back to the README](../README.md)

## Services

| Service    | Status       | Notes                                                                                 |
| ---------- | ------------ | ------------------------------------------------------------------------------------- |
| Claude     | tested       | Magic-link sign-in recommended.                                                       |
| ChatGPT    | to be tested | Email sign-in. The "Continue with Google / Apple / Microsoft" buttons may be refused. |
| Gemini     | experimental | Google sign-in: see "Gemini and Google sign-in".                                      |
| Perplexity | to be tested | Email sign-in. The "Continue with Google / Apple" buttons may be refused.             |

## Adding a service

Services are plain data in `src/main/providers.ts`. To add one (Grok, a self-hosted chat…), add an entry:

```ts
example: {
  id: 'example',                    // lowercase key, same as the object key
  label: 'Example',                 // name shown in the sidebar and menus
  url: 'https://chat.example.com/', // https only
  ua: 'clean',                      // browser identifier policy, see below
  authHosts: ['login.example.com'], // optional: sign-in domains specific to this service
},
```

- `ua`: start with `'clean'`. If the service refuses to sign in (Google does), try `'native'`.
- `authHosts`: sign-in popups that open on these domains stay inside the app, in the right account's session. Google, Microsoft and Apple sign-in are already handled for every service.
- Run `yarn test:e2e`: a test checks that every entry is well-formed. Then open a pull request.

## Gemini and Google sign-in

Google refuses sign-in from an embedded browser ("This browser or app may not be secure"). In this app, the Claude and ChatGPT services send a "cleaned" browser identifier (no `Electron/x`), which gets through anti-bot checks better. For Google it is the opposite: reports from other Electron projects say Google accepts Electron's own identifier and refuses the cleaned one ([example](https://github.com/stablyai/orca/issues/11518)).

The Gemini service therefore uses Electron's native identifier (`ua: 'native'` in `src/main/providers.ts`). This is **experimental**: Google's rule is undocumented and may change. If sign-in still fails:

- open an issue with the message displayed;
- or set `ua` to `'clean'` in `src/main/providers.ts` to compare;
- "Continue with Google" inside Claude or ChatGPT uses that service's cleaned identifier and may be refused: prefer email.

## Known limitations

- Sign-in popups (domains listed in `src/main/providers.ts`, paths such as `/oauth`, `/authorize`, `/login`) open inside the app, in the right account's session. Other links open in the default browser. This is a heuristic: if a link opens on the wrong side, adjust `AUTH_HOSTS` (`src/main/providers.ts`) or `OAUTH_PATH` (`src/main/last-url.ts`).
- Websites change without notice: rendering may evolve, but the tool itself depends on no API.
- Services may require an anti-bot check (Cloudflare, for example) depending on your network.
