# Préparer la publication dans Elgato Marketplace

Le compagnon **Discord Shortcuts 0.1.4.0** est préparé pour une soumission. Il n’a pas encore été soumis ni approuvé. Modifier le manifeste ne permet pas de déplacer une installation locale dans Marketplace.

## Fichiers préparés

- Installateur : [fr.ethan.discord-shortcuts.streamDeckPlugin](../releases/fr.ethan.discord-shortcuts.streamDeckPlugin), validé par le CLI Elgato.
- Présentation, prérequis, liens et notes de version en anglais : [LISTING.en.md](LISTING.en.md).
- Icône Marketplace 288 × 288, miniature et trois images de galerie 1920 × 960 : dossier [media](media).
- Code source, licences, guide d’installation et tests dans ce dépôt.

Les visuels sont des illustrations des fonctions et ne prétendent pas être des captures d’un test réel. La description indique explicitement la dépendance à Vencord et ShortcutToggle, l’interface française et la compatibilité Windows.

## Avant d’envoyer

1. Installer 0.1.4.0, sélectionner une touche Discord Shortcuts et essayer la recherche de mise à jour, son option quotidienne et les trois liens. La préférence doit être conservée après redémarrage de Stream Deck.
2. Essayer ON/OFF, les coupures, les changements de page et le diagnostic avec Discord réel ; vérifier que le contrôle existant fonctionne toujours.
3. Finaliser le profil dans [Maker Console](https://maker.elgato.com/) et accepter ses conditions si elles te conviennent. Le compte existe ; le profil choisi est `Sheixo` (`@sheixo`, France). Le champ Author du manifeste est `Sheixo` et doit correspondre au nom d’organisation enregistré. Ne partage pas de mot de passe.
4. Vérifier dans Marketplace que le nom proposé est disponible. Il n’a pas encore été réservé. Elgato peut demander un autre nom ou d’autres adaptations.
5. Si Maker Console ou Elgato demande une vidéo de démonstration, la fournir après un essai réel. Aucune vidéo de fonctionnement n’est incluse dans ce dossier.

## Soumission

Dans Maker Console : **Create product → Stream Deck plugin**, joindre l’installateur, reprendre les éléments en anglais et les quatre visuels, ajouter l’icône et les liens. Le projet actuel est gratuit ; vérifier ce choix avant validation du formulaire. Relire la fiche et ses conditions avant de l’envoyer.

Elgato examine chaque produit et chaque nouvelle version. La documentation annonce généralement 4 à 10 jours ouvrés, avec des délais variables. L’acceptation ne peut pas être garantie. Après approbation et publication, installer le produit depuis Marketplace pour profiter de sa distribution et des réglages de mise à jour gérés par Stream Deck.

## Sources officielles

- [Distribution du SDK](https://docs.elgato.com/streamdeck/sdk/introduction/distribution/)
- [Soumettre un produit](https://docs.elgato.com/maker-console/submitting-products/)
- [Examen des produits](https://docs.elgato.com/maker-console/review-process/)
- [Exigences des visuels](https://docs.elgato.com/guidelines/products/)
- [Règles des plugins](https://docs.elgato.com/guidelines/stream-deck/plugins/)
