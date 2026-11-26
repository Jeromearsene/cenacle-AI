# Services

[English](../services.md) · **Français**

← [Retour au README](../../README.fr.md)

## Services

| Service | État         | Remarques                                                                                             |
| ------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Claude  | testé        | Connexion par lien magique conseillée.                                                                |
| ChatGPT | à tester     | Connexion par e-mail. Les boutons « Continuer avec Google / Apple / Microsoft » peuvent être refusés. |
| Gemini  | expérimental | Connexion Google : voir « Gemini et la connexion Google ».                                            |

## Ajouter un service

Les services sont de simples données dans `src/main/providers.ts`. Pour en ajouter un (Grok, Perplexity, un chat auto-hébergé…), ajoute une entrée :

```ts
example: {
  id: 'example',                    // clé en minuscules, identique à la clé de l'objet
  label: 'Example',                 // nom affiché dans la barre latérale et les menus
  url: 'https://chat.example.com/', // https uniquement
  ua: 'clean',                      // identifiant de navigateur, voir plus bas
  authHosts: ['login.example.com'], // facultatif : domaines de connexion propres au service
},
```

- `ua` : commence par `'clean'`. Si le service refuse la connexion (Google le fait), essaie `'native'`.
- `authHosts` : les popups de connexion qui s'ouvrent sur ces domaines restent dans l'app, dans la session du bon compte. Les connexions Google, Microsoft et Apple sont déjà gérées pour tous les services.
- Lance `yarn test:e2e` : un test vérifie que chaque entrée est bien formée. Puis ouvre une pull request.

## Gemini et la connexion Google

Google refuse la connexion depuis un navigateur intégré (« Ce navigateur ou cette application ne sont peut-être pas sécurisés »). Dans cette application, les services Claude et ChatGPT envoient un identifiant de navigateur « nettoyé » (sans `Electron/x`), qui passe mieux les contrôles anti-robots. Pour Google, c'est l'inverse : des retours d'expérience d'autres projets Electron indiquent que Google accepte l'identifiant d'Electron laissé tel quel et refuse l'identifiant nettoyé ([exemple](https://github.com/stablyai/orca/issues/11518)).

Le service Gemini utilise donc l'identifiant natif d'Electron (`ua: 'native'` dans `src/main/providers.ts`). C'est **expérimental** : la règle de Google n'est pas documentée et peut changer. Si la connexion échoue quand même :

- ouvre une issue en précisant le message affiché ;
- ou passe `ua` à `'clean'` dans `src/main/providers.ts` pour comparer ;
- les connexions via « Continuer avec Google » dans Claude ou ChatGPT utilisent l'identifiant nettoyé du service et risquent d'être refusées : préfère l'e-mail.

## Limites connues

- Les popups de connexion (domaines listés dans `src/main/providers.ts`, chemins du type `/oauth`, `/authorize`, `/login`) s'ouvrent dans l'app, dans la session du bon compte. Les autres liens s'ouvrent dans le navigateur par défaut. C'est une heuristique : si un lien s'ouvre du mauvais côté, ajuste `AUTH_HOSTS` (`src/main/providers.ts`) ou `OAUTH_PATH` (`src/main/index.ts`).
- Les sites changent sans prévenir : le rendu peut évoluer, mais l'outil lui-même ne dépend d'aucune API.
- Les services peuvent exiger une vérification anti-robot (Cloudflare, par exemple) selon ton réseau.
