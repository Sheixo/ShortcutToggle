# Installer Discord Shortcuts pour Stream Deck

Le composant Stream Deck est facultatif. Il fournit le bouton qui commande ShortcutToggle et affiche son état ON/OFF.

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

## Si l’état affiche Déconnecté

Clique **Vérifier la connexion** dans les paramètres du plugin. Le test dure au maximum cinq secondes et affiche son heure et son résultat :

- **Le compagnon répond correctement** : le message attendu a été reçu et l’état ON/OFF a été envoyé. Si la liaison principale est encore déconnectée, clique **Reconnecter**.
- **Connexion locale impossible** : vérifie que Stream Deck est ouvert sur le même ordinateur et que Discord Shortcuts est installé.
- **Connexion ouverte sans réponse compatible** : redémarre Stream Deck et vérifie qu’une ancienne copie ou un autre service n’utilise pas le même port.
- **Connexion interrompue ou envoi échoué** : relance Stream Deck, puis réessaie le test.

Le diagnostic ne change pas ON/OFF et ne commande pas la touche physique. Son succès vérifie la connexion et le message du compagnon ; le fonctionnement du bouton physique doit ensuite être essayé. Le compagnon 0.1.2.0 existant reste compatible : cette mise à jour ne demande pas de le réinstaller.

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

Plusieurs clients Discord reliés au même composant reçoivent la commande de bascule. Pour un contrôle univoque, utilise une seule session cible.

## Construire l’installateur

Le [CLI officiel Elgato](https://docs.elgato.com/streamdeck/cli/commands/pack/) valide le manifeste et produit le fichier `.streamDeckPlugin`.

Le dossier du composant est `stream-deck/fr.ethan.discord-shortcuts.sdPlugin`. Son code source est dans `stream-deck/src`. Les fichiers de journal ne sont pas inclus dans le dépôt ni dans l’installateur fourni.
