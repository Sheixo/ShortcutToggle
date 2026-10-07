# Vérifications de la préparation 0.2.0

Date : **7 octobre 2026**.

## Vérifications automatisées réussies

- Compilation du fichier TSX complet.
- Vérification sémantique TypeScript contre les définitions de l’installation Vencord disponible.
- Construction complète des six composants Vencord bureau dans une copie de travail, avec les dépendances déjà installées résolues vers leurs chemins physiques. L’installation Discord active n’a pas été modifiée.
- 41 vérifications simulées de la gestion des raccourcis, dans les deux ordres possibles des notifications native/Discord, avec retards et arrêt/redémarrage du plugin.
- 24 vérifications simulées de l’enregistrement, de l’annulation, des combinaisons, des modificateurs droits, d’AZERTY, du pavé numérique et du retour au dernier raccourci valide après une erreur.
- 20 vérifications des contrôles de l’interface et de Stream Deck : filtres, sélection par lots, sélection des résultats, migration des préférences, déconnexion, reconnexion et événements d’anciens sockets.
- Validation du manifeste et création de l’installateur Stream Deck avec le CLI officiel Elgato, sans erreur ni avertissement.

## Limites de cette vérification

Les 85 vérifications de comportement utilisent des modules Discord simulés. Elles ne constituent pas un test dans une session Discord réelle.

L’aperçu HTML est construit à partir des composants du plugin, avec un moteur de démonstration et des raccourcis fictifs. Son ouverture automatique a été bloquée par les règles du navigateur de l’application : il doit être ouvert manuellement pour contrôler son rendu sombre/clair.

Le composant Stream Deck conserve le code et le protocole de la version personnelle déjà utilisée ; son installateur a été validé et produit, sans installation de la nouvelle copie dans l’application Stream Deck.

## Essai à effectuer avant la première diffusion

1. Installer le nouveau `index.tsx`, reconstruire Vencord et redémarrer Discord.
2. Vérifier le bouton ON/OFF, l’enregistrement de F13 et d’une combinaison, puis l’annulation avec Échap.
3. Sur OFF, cocher/décocher un raccourci et essayer les boutons de sélection, avec et sans recherche.
4. Ajouter, modifier et supprimer un raccourci dans Discord, sur ON puis OFF.
5. Activer/désactiver Stream Deck et vérifier l’état, le bouton physique et la reconnexion après fermeture/réouverture de son application.

Le dossier correspond à la publication indépendante [Sheixo/ShortcutToggle](https://github.com/Sheixo/ShortcutToggle). Les essais dans Discord et Stream Deck restent à effectuer après installation.
