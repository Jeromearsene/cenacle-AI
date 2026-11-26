# Installation

[English](../install.md) · **Français**

← [Retour au README](../../README.fr.md)

## Plateformes

| Plateforme | État                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| macOS      | plateforme principale, utilisée et testée au quotidien par l'auteur                                     |
| Linux      | prise en charge ; les tests de bout en bout tournent sous Linux en CI                                   |
| Windows    | prise en charge ; les tests de bout en bout tournent sous Windows en CI, mais l'auteur ne l'utilise pas |

Les installateurs (`.dmg` macOS, `.exe` Windows, AppImage et `.deb` Linux) sont joints à chaque [release](https://github.com/Jeromearsene/cenacle-AI/releases) ; tu peux aussi [lancer l'app depuis les sources](development.md#lancer-depuis-les-sources). Les installateurs ne sont **pas encore signés** : macOS bloque le premier lancement (voir ci-dessous), Windows affiche un avertissement SmartScreen, et macOS ne peut pas se mettre à jour tant que l'app n'est pas signée. Les remarques propres à une plateforme sont signalées « macOS », « Windows » ou « Linux ».

**Premier lancement sur macOS** (l'app n'est pas encore signée ni notarisée) :

1. Ouvre le `.dmg`, glisse Cénacle dans Applications et lance-le. macOS refuse de l'ouvrir.
2. Ouvre Réglages Système → Confidentialité et sécurité, descends jusqu'au message concernant Cénacle, clique sur « Ouvrir quand même » et confirme. Sous macOS 15 (Sequoia) et plus récent, le raccourci clic droit → Ouvrir ne fonctionne plus.
3. Si macOS indique que l'app est « endommagée », retire l'attribut de quarantaine puis relance-la : `xattr -dr com.apple.quarantine /Applications/Cénacle.app`.

Tant que l'app n'est pas signée, macOS ne peut pas la mettre à jour : télécharge chaque nouvelle version depuis la page des releases.

**Mises à jour** : une app installée (et non lancée depuis les sources) cherche une nouvelle version sur GitHub Releases au démarrage et la télécharge en arrière-plan ; la mise à jour s'applique à la prochaine fermeture de l'app. Sous Linux, cela fonctionne pour l'AppImage, pas pour le `.deb`. Pour désactiver la vérification, définis la variable d'environnement `CENACLE_DISABLE_UPDATES` avec n'importe quelle valeur non vide avant de lancer l'app.
