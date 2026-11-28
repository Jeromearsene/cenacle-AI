# Développement

[![CI](https://github.com/Jeromearsene/cenacle-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Jeromearsene/cenacle-AI/actions/workflows/ci.yml)
![Electron 45](https://img.shields.io/badge/Electron-45-47848F?logo=electron&logoColor=white)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Lint : Biome](https://img.shields.io/badge/lint-Biome-60A5FA?logo=biome&logoColor=white)

[English](../development.md) · **Français**

← [Retour au README](../../README.fr.md)

## Lancer depuis les sources

```bash
yarn install
yarn dev        # développement : rechargement à chaud de l'interface
yarn build      # construit dans out/
yarn start      # lance l'app construite
```

Le projet utilise Yarn 4 (4.18.1), avec `nodeLinker: node-modules` dans `.yarnrc.yml` : Electron ne fonctionne pas avec le mode Plug'n'Play.

**Versions fixées**

- Avec [Volta](https://volta.sh) : la clé `volta` de `package.json` fixe Node (22.23.5) et Yarn (4.18.1).
- Sans Volta : `corepack enable` suffit, le champ `packageManager` indique la version de Yarn.
- Volta ne documente clairement que Yarn 1.x et 3 et plus. Si Volta n'arrive pas à récupérer Yarn 4, supprime la ligne `"yarn"` de la clé `volta` et passe par Corepack.

**Délai de sécurité de Yarn** : par défaut, Yarn 4 refuse les versions publiées depuis moins de 24 h (`npmMinimalAgeGate`). Electron est indiqué en `^45.3.3` ; `yarn up electron` le met à jour quand la dernière version est assez ancienne.

Le binaire d'Electron (environ 100 Mo) est téléchargé par `yarn install` (script `postinstall`). Si le téléchargement a échoué ou n'a pas eu lieu, `node node_modules/electron/install.js` le relance ; sans lui, `yarn dev` et `yarn start` s'arrêtent avec « Electron uninstall ».

## Outils, tests et versions

Pile : Electron, TypeScript (strict), [electron-vite](https://electron-vite.org), Preact, Tailwind CSS 4, [Biome](https://biomejs.dev) (lint et formatage), Playwright. L'interface (barre latérale) pèse une trentaine de Ko de JavaScript ; les pages des services sont de vraies pages web, sans code de notre part.

```bash
yarn dist        # construit les installateurs du système courant dans release/
yarn dist:dir    # idem, non empaqueté (vérification rapide du packaging)
yarn changeset   # décrit un changement pour le changelog (voir plus bas)
yarn lint        # Biome : lint + vérification du format (yarn lint:fix pour corriger, yarn format pour formater)
yarn typecheck   # TypeScript, processus principal + interface
yarn check       # lint + typecheck
yarn test:e2e    # construit l'app puis lance les tests de bout en bout
yarn test:scripts # tests du dossier scripts/ (la mise à jour du cask Homebrew)
```

Les tests lancent l'app Electron avec Playwright, contre un faux service local (variable `MULTI_TEST_URL`, ignorée dans une app empaquetée) : aucun accès réseau ni compte réel. Ils vérifient l'ajout et le renommage d'un compte, la grille (glisser-déposer, retrait, redimensionnement), l'isolation des cookies et du stockage entre comptes, l'identifiant de navigateur de chaque service, la persistance après redémarrage et le menu du clic droit. Sous Linux sans écran : `xvfb-run -a yarn test:e2e` (les tests ajoutent `--no-sandbox` tout seuls quand ils tournent en root ou en CI). Sous Linux, si Electron s'arrête au démarrage avec une erreur « SUID sandbox helper » (fréquent sur Ubuntu récent), lance `yarn dev --no-sandbox`.

**Intégration continue** (`.github/workflows/ci.yml`) : à chaque envoi sur `main` et à chaque pull request, lint et format, vérification des types et build sous Linux, puis tests de bout en bout sous macOS, Linux et Windows. Dependabot propose chaque semaine les mises à jour des dépendances. Un second workflow (`.github/workflows/cask.yml`) tourne quand le cask Homebrew change : sur des machines Apple Silicon et Intel, il ajoute le dépôt comme tap, lance `brew style` et `brew audit`, installe l'app, vérifie sa version, son architecture, sa signature et l'attribut de quarantaine, la lance, puis la désinstalle avec `--zap`.

**Versions et changelog** passent par [Changesets](https://github.com/changesets/changesets). Un changement visible par les utilisateurs s'accompagne d'un changeset (`yarn changeset`, une ligne qui le décrit). Une fois fusionné sur `main`, un robot tient à jour une pull request « Version packages » ; la fusionner augmente la version, met à jour `CHANGELOG.md`, crée le tag et construit les installateurs pour les trois systèmes (`.github/workflows/release.yml`). L'app cherche une mise à jour au démarrage quand elle est installée (`src/main/updater.ts`).

**Homebrew** : ce dépôt est aussi un _tap_ Homebrew (les utilisateurs lancent `brew tap Jeromearsene/cenacle <l'adresse de ce dépôt>`, puis `brew install --cask cenacle`). Le cask est `Casks/cenacle.rb`, modifié à la main sauf pour trois valeurs : la version et le SHA-256 des deux `.dmg` macOS. Une fois les installateurs d'une release joints, le workflow de release lance `scripts/homebrew/update-cask.mjs`, qui lit ces valeurs dans la release et ouvre une pull request ; la fusionner publie la nouvelle version pour les utilisateurs de Homebrew. Pour le faire à la main : `node scripts/homebrew/update-cask.mjs --tag v0.8.0`. Le workflow laisse le cask tranquille quand le tag n'est pas la dernière release (lancement manuel sur une ancienne release). Si les noms des installateurs (`artifactName` dans `electron-builder.yml`) ou celui du paquet de l'app changent, change aussi le cask : `yarn test:scripts` vérifie qu'ils concordent. Une app signée et notarisée permettrait de supprimer du cask le bloc `postflight` qui retire l'attribut de quarantaine.

```
src/main/index.ts                 processus principal : fenêtre, une vue par compte, mise en page, menu
src/main/providers.ts             services pris en charge (URL, identifiant de navigateur, domaines de connexion)
src/main/permissions.ts            permissions accordées aux pages des services
src/main/state.ts                 lecture / validation / écriture de state.json
src/main/context-menu*.ts         menu du clic droit (modèle pur + branchement)
src/main/account-notifications.ts titre et pastille de couleur des notifications d'un compte
src/preload/index.ts              pont minimal vers l'interface (contextBridge)
src/preload/service.ts            preload des pages de service : n'expose rien ; habille les notifications, lit le bandeau de limite
src/shared/grid.ts                arbre de la grille : dépôts, redimensionnement, géométrie (pur, testé)
src/shared/quota.ts               lecture du bandeau de limite, calculs du sablier (pur, testé)
src/shared/metrics.ts             mémoire / CPU par compte à partir de la liste des processus (pur, testé)
src/main/quota.ts                 état de limite par compte, minuteurs de réinitialisation
src/shared/types.ts               types partagés entre les trois
src/renderer/                     interface Preact + Tailwind (barre latérale, en-têtes de cases, grille)
resources/                        icône de l'app (source SVG, PNG, ICO, ICNS)
e2e/                              tests Playwright
Casks/cenacle.rb                  cask Homebrew (ce dépôt est son propre tap)
scripts/homebrew/                 met à jour le cask après une release, avec ses tests
.github/                          workflows CI, release et cask, Dependabot
docs/                             la documentation (anglais ; français dans docs/fr/)
```

## Ajouter une langue

Pour ajouter une langue, ajoute son code à `LOCALES`, son propre nom à `LOCALE_LABELS`, et un jeu complet de messages dans `src/shared/i18n.ts` (TypeScript refuse un jeu incomplet), puis une ligne de test dans `e2e/i18n.spec.ts`. Pour essayer une langue sans changer celle du système, lance l'app non empaquetée avec `CENACLE_LANG=fr yarn dev`.

## Automatisation (Playwright / Puppeteer), désactivée par défaut

```bash
CENACLE_DEBUG_PORT=9222 yarn dev
```

Cela ouvre le protocole de débogage Chrome sur `127.0.0.1:9222` uniquement. Exemple :

```js
const { chromium } = require('playwright-core');

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
for (const context of browser.contexts()) {
  for (const page of context.pages()) console.log(page.url());
}
```

Attention : tout processus local qui atteint ce port contrôle toutes les sessions connectées. Ne laisse pas la variable définie en permanence. Vérifie aussi les conditions d'utilisation des services avant d'automatiser quoi que ce soit.
