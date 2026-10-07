# Installer Discord Shortcuts pour Stream Deck

Le composant Stream Deck est facultatif. Il fournit le bouton qui commande ShortcutToggle et affiche son état ON/OFF.

Cette publication associe **ShortcutToggle 0.2.7** à **Discord Shortcuts 0.1.4.0**. Mets à jour le fichier `index.tsx`, reconstruis Vencord, redémarre Discord et ouvre le nouvel installateur Stream Deck pour bénéficier de toutes les améliorations.

## Prérequis

- Windows 10 ou plus récent.
- Application Stream Deck **7.1 ou plus récente**, conformément au manifeste du composant fourni.
- ShortcutToggle activé dans Discord bureau avec Vencord.

## Installation

1. Télécharge [fr.ethan.discord-shortcuts.streamDeckPlugin](../releases/fr.ethan.discord-shortcuts.streamDeckPlugin).
2. Ouvre le fichier pour l’installer dans l’application Stream Deck.
3. Ajoute l’action **Discord Shortcuts → Raccourcis Clavier Discord** à une touche.
4. Dans les paramètres de ShortcutToggle, coche **Activer la connexion Stream Deck**.
5. L’état doit afficher **Connecté**. Presse la touche Stream Deck : le bouton Discord et le statut ON/OFF doivent changer ensemble.

L’UUID existant `fr.ethan.discord-shortcuts` est conservé pour que les touches déjà configurées restent associées au même composant.

## Version, mises à jour et liens utiles

Dans la fenêtre principale de Stream Deck, sélectionne une touche **Discord Shortcuts**. Son panneau affiche :

- La version du compagnon communiquée par Stream Deck (0.1.4.0 pour cette publication), distincte de la version Vencord.
- L’état Discord ON/OFF ou Hors ligne, sans commande de bascule lors d’une vérification.
- **Rechercher les mises à jour**, le dernier contrôle et, si une version supérieure existe, **Télécharger la mise à jour** / **Voir les nouveautés**.
- **Vérifier automatiquement** : choix global mémorisé par Stream Deck, commun à toutes les touches. Premier essai environ vingt secondes après démarrage, puis un contrôle réussi par jour ; une erreur est réessayée après une heure. La recherche manuelle reste disponible si ce choix est désactivé.
- GitHub, l’installation complète et l’aide.

La recherche consulte les cent publications GitHub récentes et les métadonnées d’au plus dix publications qui fournissent un compagnon. Les brouillons et entrées incompatibles sont ignorés ; les préversions publiées sont incluses. La version du compagnon et les informations de son installateur doivent correspondre aux métadonnées de la publication. Les requêtes durent au maximum dix secondes au total et ne transmettent ni identifiant Discord, token, cookies ni données de profil Stream Deck.

Une erreur conserve le dernier résultat connu. Une mise à jour de Vencord seule ne sera pas présentée comme une nouvelle version du compagnon. Les liens sont construits uniquement vers Sheixo/ShortcutToggle ; l’interface ne peut pas fournir une URL arbitraire au plugin.

Dans **Préférences → Plug-ins**, Stream Deck affiche déjà la version et utilisera le lien GitHub du manifeste. Les contrôles de cette fenêtre sont gérés par Stream Deck. **L’installation depuis GitHub reste manuelle** : télécharger puis ouvrir le fichier `.streamDeckPlugin`. Les options natives de mise à jour automatique et la sortie de **Locaux** nécessitent une publication approuvée puis une installation via Marketplace. Voir le [dossier préparé](../marketplace/SOUMISSION.fr.md).

## État du bouton et reconnexion

- **Hors ligne** : aucun état Discord valide n’est encore disponible. Une connexion ouverte ne suffit pas à afficher ON/OFF.
- **ON/OFF** : état confirmé par Discord, également actualisé quand la bascule vient du hotkey ou du bouton Discord.
- **…** : commande en attente. Les pressions supplémentaires sont ignorées jusqu’à confirmation ou expiration, afin d’éviter plusieurs bascules involontaires.

La liaison est contrôlée périodiquement. Après une coupure, le compagnon abandonne les connexions bloquées et Discord tente de se reconnecter. Une commande sans réponse n’est pas renvoyée automatiquement : le compagnon demande l’état actuel. Après un changement de page ou de profil Stream Deck, les touches qui réapparaissent reçoivent également l’état courant. Un échec d’affichage est réessayé tant que la touche est visible.

Les images et titres personnalisés dans Stream Deck gardent la priorité. Pour voir l’indicateur Hors ligne fourni, laisse la touche utiliser ses images et titres par défaut.

## Si l’état affiche Déconnecté

Clique **Vérifier la connexion** dans les paramètres du plugin. Le test dure au maximum cinq secondes et affiche son heure et son résultat :

- **Le compagnon répond correctement** : le message attendu a été reçu et l’état ON/OFF a été envoyé. Si la liaison principale est encore déconnectée, clique **Reconnecter**.
- **Connexion locale impossible** : vérifie que Stream Deck est ouvert sur le même ordinateur et que Discord Shortcuts est installé.
- **Connexion ouverte sans réponse compatible** : redémarre Stream Deck et vérifie qu’une ancienne copie ou un autre service n’utilise pas le même port.
- **Connexion interrompue ou envoi échoué** : relance Stream Deck, puis réessaie le test.

Le diagnostic ne change pas ON/OFF et ne commande pas la touche physique. Son succès vérifie la connexion et le message du compagnon ; le fonctionnement du bouton physique doit ensuite être essayé. Le compagnon 0.1.4.0 distingue la connexion de diagnostic de la session de contrôle. Les versions précédentes restent compatibles avec les messages de base, mais la mise à jour des deux composants est nécessaire pour toutes les améliorations de fiabilité.

- Vérifie que l’application Stream Deck est ouverte et le composant installé.
- Vérifie que Discord et ShortcutToggle sont démarrés.
- Clique **Reconnecter**. Le plugin essaie aussi automatiquement toutes les deux secondes.
- Une tentative de connexion bloquée est abandonnée au bout de cinq secondes avant un nouvel essai. Le panneau indique les tentatives depuis l’activation et l’heure du dernier contact.
- Utilise une seule installation du composant par ordinateur : elle doit pouvoir écouter sur le port local **45873**.

Ne configure pas de redirection de port sur ton routeur : la connexion utilise seulement `127.0.0.1`, sur l’ordinateur où Discord fonctionne.

## Protocole local

Le composant écoute sur `ws://127.0.0.1:45873`. Discord se connecte comme client.

- Stream Deck → Discord : `{"type":"toggle"}` ou `{"type":"getState"}`.
- Discord → Stream Deck : `{"type":"state","disabled":false}` pour ON, `true` pour OFF.
- Discord → Stream Deck : annonce optionnelle `{"type":"hello","role":"control","protocolVersion":1}`, ou `role:"diagnostic"` pour une vérification temporaire. Les anciens clients sans annonce sont reconnus comme clients de contrôle dès réception d’un état valide.

Le compagnon garde une session de contrôle stable et lui envoie chaque bascule une seule fois. Si elle disparaît, une autre session ayant confirmé son état peut prendre le relais. Les connexions de diagnostic ne pilotent pas le bouton. Pour choisir sans ambiguïté le Discord ciblé, utilise une seule session de contrôle.

Le compagnon demande régulièrement l’état et utilise les ping/pong WebSocket pour détecter les connexions rompues. La réponse attendue à une commande est limitée à 1,5 seconde ; l’état est ensuite redemandé. Une demande d’état sans réponse pendant cinq secondes entraîne l’abandon de la connexion.

## Essai après installation

1. Essaie la touche, le hotkey et le bouton Discord : leurs états doivent rester synchronisés.
2. Ferme complètement Discord : la touche doit afficher Hors ligne. Relance Discord et attends le retour sur ON, état de démarrage du plugin.
3. Ferme puis relance Stream Deck : la liaison doit reprendre automatiquement sans bascule supplémentaire.
4. Change de page/profil puis reviens sur les touches Discord Shortcuts ; essaie aussi deux touches configurées avec la même action.
5. Lance **Vérifier la connexion** sur ON puis OFF : le diagnostic doit conserver l’état.

## Construire l’installateur

Le [CLI officiel Elgato](https://docs.elgato.com/streamdeck/cli/commands/pack/) valide le manifeste et produit le fichier `.streamDeckPlugin`.

Le dossier du composant est `stream-deck/fr.ethan.discord-shortcuts.sdPlugin`. Son code source est dans `stream-deck/src`. Les fichiers de journal ne sont pas inclus dans le dépôt ni dans l’installateur fourni.

Après chaque nouvelle construction, produire le descripteur avec `node scripts/prepare-companion-release.cjs v0.2.7` (adapter le tag), puis joindre **streamdeck-update.json** avec l’installateur dans la même publication GitHub. Les vérifications du compagnon se basent sur ce fichier et les tailles/empreintes des assets GitHub. Le manifeste distribué n’est pas lu ou modifié à l’exécution, pour rester compatible avec la protection de fichiers Marketplace.
