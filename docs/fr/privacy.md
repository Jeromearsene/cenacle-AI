# Vie privée, permissions et connexion

[English](../privacy.md) · **Français**

← [Retour au README](../../README.fr.md)

## Isolation

Chaque compte vit dans sa propre partition de navigateur : cookies, stockage local, cache et service workers ne sont jamais partagés, pas même entre deux comptes du même service. Supprimer un compte efface sa partition. L'application n'utilise ni API ni clé, et n'a pas de serveur à elle : les pages que tu vois sont les sites des services eux-mêmes, et tes sessions restent sur ton ordinateur.

## Permissions

Les pages des services sont des sites web : l'app ne leur accorde que ce qu'un chat demande, c'est-à-dire les notifications, le copier-coller, le plein écran et le **micro** (mode vocal). La caméra, le partage d'écran, la localisation et toutes les autres permissions sont refusés. Seule la page elle-même, pas un cadre tiers qu'elle intègre, peut utiliser les notifications ou le micro. La règle est dans `src/main/permissions.ts`.

## Mots de passe et clés d'accès

Ce qui **ne fonctionne pas** aujourd'hui, et pourquoi :

- **Le remplissage automatique des mots de passe du système (macOS : app Mots de passe d'Apple / trousseau iCloud)** n'est pas proposé dans les apps Electron. Electron a une demande de fonctionnalité ouverte pour les fournisseurs de mots de passe macOS sur les champs HTML ([electron/electron#54142](https://github.com/electron/electron/issues/54142)). Pour les moteurs de navigateur tiers, l'intégration d'iCloud Passwords exige en plus un droit restreint (`com.apple.developer.browser`) qu'Apple accorde sur demande, comme l'a documenté un autre navigateur basé sur Chromium ([ego-lite#362](https://github.com/citrolabs/ego-lite/issues/362)).
- **Touch ID et clés d'accès** : Electron ne les propose qu'après `app.configureWebAuthn`, et elles exigent une app signée avec des droits Apple. Les clés d'accès déjà enregistrées dans ton trousseau iCloud n'apparaîtraient pas. Sur l'écran de connexion Google, choisis « Essayer une autre méthode » et utilise ton mot de passe avec la validation en deux étapes.

Ce que tu peux faire :

- Copier le mot de passe depuis ton gestionnaire, puis coller avec ⌘V ou clic droit → Coller (le menu contextuel est là pour ça).
- Gestionnaires tiers : le remplissage universel de 1Password (⌘\) est signalé comme fonctionnel dans certaines apps Electron signées (même ticket #54142) ; il n'a **pas** été testé avec cette app.

## Où sont les données

- Sessions : dossier `Partitions/` dans le dossier de données de l'app. Une partition par compte.
  - macOS : `~/Library/Application Support/Cénacle/`
  - Windows : `%APPDATA%\Cénacle\`
  - Linux : `~/.config/Cénacle/`
- Liste des comptes, mise en page, taille de fenêtre, adresse de la dernière conversation de chaque compte et petite icône de chaque service (le favicon annoncé par sa page, récupéré avec la session du compte) : `state.json` dans le même dossier.
- Les données de session ne sont jamais dans le dossier du projet.
