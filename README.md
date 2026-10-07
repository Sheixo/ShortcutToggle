# ShortcutToggle

[English](README.en.md)

Active ou suspend les raccourcis personnalisés Discord depuis un bouton, un raccourci clavier ou un Stream Deck.

Version **0.2.7** · Interface française · **Discord bureau sous Windows** · Plugin communautaire indépendant.

## Fonctionnalités

- État ON/OFF visible dans les paramètres et bouton dans le panneau micro/casque de Discord.
- Étoile Favori dans la première carte des paramètres : épingle ShortcutToggle en haut de la liste Vencord et mémorise ce choix.
- Enregistrement du raccourci global par pression des touches, avec Échap pour annuler et réinitialisation à F13.
- Alerte si la même combinaison est déjà affectée à une action Discord, pendant l’enregistrement et pour le raccourci enregistré.
- Recherche par touche ou action, sélection par lots et compteurs.
- Quand une recherche est active, les boutons de sélection agissent seulement sur ses résultats.
- Synchronisation des ajouts, suppressions et changements de touche/action sans modifier ON/OFF.
- Les nouveaux raccourcis sont automatiquement sélectionnés. Les raccourcis décochés restent décochés après modification.
- Un raccourci désactivé par Discord reste désactivé, y compris après un retour sur ON.
- Connexion Stream Deck facultative avec état visible, reconnexion automatique et bouton Reconnecter.
- Boutons Stream Deck synchronisés sur l’état confirmé par Discord, affichage Hors ligne après une coupure, contrôle périodique et protection contre les pressions répétées pendant une commande.
- Diagnostic Stream Deck à la demande : vérification de la réponse du compagnon, résultat daté, dernier contact et aide en cas d’échec, sans basculer ON/OFF.
- Notification d’une nouvelle version avec lien GitHub, vérification automatique quotidienne désactivable et bouton de vérification manuelle.
- Panneau du compagnon Stream Deck avec sa propre version, recherche de mises à jour manuelle/quotidienne, état Discord et liens d’installation/GitHub/aide.

ON permet aux raccourcis cochés de fonctionner. OFF suspend leurs actions. Les raccourcis non cochés restent disponibles.

## Aperçu

Ouvre [l’aperçu interactif](docs/apercu.html) dans ton navigateur après téléchargement. Il utilise les composants du plugin avec des données de démonstration, sans modifier Discord. Le changement de thème sert uniquement à cet aperçu. Enregistre G ou B pour essayer l’alerte de conflit.

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

- **Favori** : clique sur l’étoile à côté du titre ShortcutToggle dans la première carte des paramètres. Elle devient jaune et le plugin rejoint les favoris Vencord ; clique de nouveau pour le retirer.
- **Enregistrer un raccourci** : presse une touche ou une touche avec Ctrl, Maj, Alt ou Windows, puis relâche toutes les touches.
- Les lettres, chiffres, touches F1 à F24, touches de navigation et principales touches du pavé numérique sont prises en charge. Les modificateurs droits sont distingués.
- Échap, la perte de focus de la fenêtre ou la fermeture des paramètres annulent l’enregistrement.
- L’alerte de conflit indique les actions Discord concernées, même si elles sont décochées dans ShortcutToggle. Un raccourci désactivé dans Discord est signalé comme un conflit possible s’il est réactivé. L’alerte se met à jour après ajout, suppression ou modification d’un raccourci ; elle permet de conserver la combinaison.
- La comparaison porte sur les combinaisons complètes présentes dans le magasin de raccourcis Discord, indépendamment de l’ordre des touches. Elle distingue clavier/souris, modificateurs gauche/droit et pavé numérique. Elle ne détecte pas les raccourcis d’autres applications ni les raccourcis fixes absents de ce magasin.
- Durant l’enregistrement, le hotkey global et les raccourcis personnalisés capturés sont suspendus pour éviter des actions involontaires.
- La liste se met à jour automatiquement quand Discord change ses raccourcis.
- La recherche ne change pas la sélection. Les boutons indiquent clairement s’ils concernent tout ou seulement les résultats.

## Stream Deck (facultatif)

Consulte le [guide Stream Deck](docs/STREAM_DECK.fr.md). Le composant associé **Discord Shortcuts 0.1.4.0** est fourni dans `stream-deck/` et son installateur dans `releases/`. Mets à jour le fichier Vencord et le compagnon. Les identifiants du composant et de son action sont conservés pour garder les touches déjà configurées.

Le plugin Vencord fonctionne également avec Stream Deck désactivé. La connexion, lorsqu’elle est activée, utilise uniquement `127.0.0.1:45873` et échange l’état ON/OFF et des commandes de bascule. Aucun compte Discord ni token n’est demandé.

Le bouton **Vérifier la connexion** utilise une connexion temporaire pour attendre le message existant du compagnon et lui transmettre l’état actuel. Il distingue une connexion inaccessible, une réponse compatible absente, une interruption et un échec d’envoi. **Reconnecter** relance la liaison principale. Le nouveau compagnon distingue cette vérification de la session qui commande les boutons, pour éviter les changements d’état liés au diagnostic. Les versions précédentes restent compatibles avec les messages de base.

Une touche montre **Hors ligne** jusqu’à réception d’un état valide. Les boutons visibles et ceux qui réapparaissent après un changement de page reprennent l’état confirmé. Pendant une bascule, les pressions supplémentaires sont ignorées jusqu’à confirmation ou expiration ; une commande dont la réponse manque n’est jamais renvoyée automatiquement. Les titres et images personnalisés dans Stream Deck gardent la priorité sur ceux du plugin.

Sélectionne une touche **Discord Shortcuts** dans la fenêtre principale de Stream Deck pour ouvrir son nouveau panneau : version installée, recherche manuelle, option de vérification quotidienne, téléchargement et liens utiles. Dans **Préférences → Plug-ins**, le lien GitHub est aussi fourni par le manifeste. La recherche automatique est distincte de l’installation automatique : les versions GitHub se téléchargent et s’installent manuellement.

Le compagnon reste dans **Locaux** tant qu’il est installé depuis GitHub. Les réglages de mise à jour natifs comme ceux de SuperMacro nécessitent une distribution via Elgato. Un [dossier de soumission Marketplace](marketplace/SOUMISSION.fr.md) est préparé ; le compte Maker Console, les essais réels, la soumission et l’approbation restent nécessaires.

## Notifications de mise à jour

La carte **Mises à jour** affiche la version installée. La vérification automatique est activée par défaut : premier contrôle environ vingt secondes après le démarrage, puis au plus une vérification réussie par jour. Une erreur est réessayée après une heure. La date du dernier contrôle réussi et la version trouvée sont conservées entre les redémarrages.

Chaque nouvelle version publiée, préversions incluses, est annoncée une seule fois par notification Vencord. Clique sur la notification ou sur **Ouvrir le téléchargement sur GitHub** pour ouvrir sa publication. Télécharge ensuite `index.tsx`, remplace ton fichier, reconstruis Vencord et redémarre Discord. L’installation reste manuelle.

Tu peux désactiver **Vérifier automatiquement les nouvelles versions** et utiliser **Vérifier les mises à jour** à la demande. La requête consulte les métadonnées publiques des cent publications GitHub les plus récentes de Sheixo/ShortcutToggle, sans compte Discord, token ni cookies. Les liens sont construits uniquement vers ce dépôt. Une erreur réseau conserve l’information précédemment connue et affiche l’heure du dernier contrôle réussi.

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
