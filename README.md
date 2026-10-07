# ShortcutToggle

[English](README.en.md)

Active ou suspend les raccourcis personnalisés Discord depuis un bouton, un raccourci clavier ou un Stream Deck.

Version **0.2.0** · Interface française · **Discord bureau sous Windows** · Plugin communautaire indépendant.

## Fonctionnalités

- État ON/OFF visible dans les paramètres et bouton dans le panneau micro/casque de Discord.
- Enregistrement du raccourci global par pression des touches, avec Échap pour annuler et réinitialisation à F13.
- Recherche par touche ou action, sélection par lots et compteurs.
- Quand une recherche est active, les boutons de sélection agissent seulement sur ses résultats.
- Synchronisation des ajouts, suppressions et changements de touche/action sans modifier ON/OFF.
- Les nouveaux raccourcis sont automatiquement sélectionnés. Les raccourcis décochés restent décochés après modification.
- Un raccourci désactivé par Discord reste désactivé, y compris après un retour sur ON.
- Connexion Stream Deck facultative avec état visible, reconnexion automatique et bouton Reconnecter.

ON permet aux raccourcis cochés de fonctionner. OFF suspend leurs actions. Les raccourcis non cochés restent disponibles.

## Aperçu

Ouvre [l’aperçu interactif](docs/apercu.html) dans ton navigateur après téléchargement. Il utilise les composants du plugin avec des données de démonstration, sans modifier Discord. Le changement de thème sert uniquement à cet aperçu.

## Installation du plugin Vencord

1. Utilise une installation de Vencord construite depuis ses sources. Le [guide officiel](https://docs.vencord.dev/installing/custom-plugins/) explique ce prérequis.
2. Copie le dossier `shortcutToggle` de ce dépôt dans `Vencord/src/userplugins/`.
3. Depuis ton dossier Vencord, lance :

   ```powershell
   pnpm.cmd build
   ```

4. Ferme complètement Discord, y compris son icône près de l’horloge, puis relance-le.
5. Active **ShortcutToggle** dans **Paramètres → Vencord → Plugins**, puis ouvre sa roue dentée.

Pour mettre à jour une version existante, remplace seulement `src/userplugins/shortcutToggle/index.tsx`, reconstruis Vencord et redémarre Discord. Une installation déjà injectée n’a normalement pas besoin d’une nouvelle injection pour cette mise à jour.

Lors d’une installation neuve, les raccourcis personnalisés existants sont sélectionnés et Stream Deck est désactivé. Lors de la mise à jour de notre ancienne version, la sélection et la connexion Stream Deck sont conservées. Le plugin démarre sur ON ; ON/OFF n’est pas mémorisé entre les redémarrages.

## Utilisation

- **Enregistrer un raccourci** : presse une touche ou une touche avec Ctrl, Maj, Alt ou Windows, puis relâche toutes les touches.
- Les lettres, chiffres, touches F1 à F24, touches de navigation et principales touches du pavé numérique sont prises en charge. Les modificateurs droits sont distingués.
- Échap, la perte de focus de la fenêtre ou la fermeture des paramètres annulent l’enregistrement.
- Durant l’enregistrement, le hotkey global et les raccourcis personnalisés capturés sont suspendus pour éviter des actions involontaires.
- La liste se met à jour automatiquement quand Discord change ses raccourcis.
- La recherche ne change pas la sélection. Les boutons indiquent clairement s’ils concernent tout ou seulement les résultats.

## Stream Deck (facultatif)

Consulte le [guide Stream Deck](docs/STREAM_DECK.fr.md). Le composant associé **Discord Shortcuts 0.1.2.0** est fourni dans `stream-deck/` et son installateur dans `releases/`.

Le plugin Vencord fonctionne également avec Stream Deck désactivé. La connexion, lorsqu’elle est activée, utilise uniquement `127.0.0.1:45873` et échange l’état ON/OFF et des commandes de bascule. Aucun compte Discord ni token n’est demandé.

## Développement et vérifications

```powershell
npm install
npm test
```

`npm test` compile le TSX complet et exécute les tests simulés du comportement et des contrôles de l’interface.

Pour vérifier les types avec une installation Vencord :

```powershell
npm run typecheck -- "C:\chemin\vers\Vencord"
```

Pour reconstruire le composant Stream Deck :

```powershell
npm --prefix stream-deck ci
npm --prefix stream-deck run build
```

Pour générer son installateur avec le CLI Elgato :

```powershell
npx --prefix stream-deck streamdeck pack stream-deck/fr.ethan.discord-shortcuts.sdPlugin --output releases --no-update-check
```

Les détails de vérification de cette préparation figurent dans [VALIDATION.fr.md](docs/VALIDATION.fr.md). Une validation automatisée ne remplace pas le test dans Discord et dans l’application Stream Deck après installation.

## Compatibilité et maintenance

La version initiale cible Discord bureau sous Windows. Le navigateur, Linux et macOS ne sont pas annoncés comme compatibles. Certaines fonctions internes de Discord peuvent changer après une mise à jour ; signale alors ta version Discord/Vencord et les étapes permettant de reproduire le problème, sans envoyer de token ni de fichiers de session.

Le code a été développé avec l’assistance de **Codex**. Ce dépôt est indépendant de Vencord, Discord et Elgato. Une éventuelle intégration officielle à Vencord nécessiterait leur revue et le respect de leurs [règles de contribution](https://github.com/Vendicated/Vencord/blob/main/CONTRIBUTING.md).

Licence : [GPL-3.0-or-later](LICENSE). Les bibliothèques incorporées au composant Stream Deck conservent leurs licences : [notices tierces](stream-deck/THIRD_PARTY_NOTICES.txt).
