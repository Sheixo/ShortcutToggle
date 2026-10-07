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

## Mise à jour 0.2.1 — profil auteur

L’entrée Authors utilise désormais l’identifiant Discord fourni par le créateur. Vencord peut ainsi récupérer son avatar et ouvrir son profil réel.

Cette correction porte sur les métadonnées de l’auteur. Les vérifications de compilation et les 85 tests simulés décrits ci-dessus concernent la préparation 0.2.0 ; ils n’ont pas été relancés pour cette modification de métadonnées. L’affichage du profil reste à vérifier dans Discord après reconstruction et redémarrage.

## Mise à jour 0.2.2 — favoris Vencord

La première carte des paramètres réutilise le composant FavoriteButton de Vencord et son réglage partagé `plugins.ShortcutToggle.isFavorite`. Le tri et le filtre des favoris Vencord utilisent ce même réglage ; Vencord assure son enregistrement.

- Compilation du TSX complet et 85 vérifications simulées relancées avec succès.
- Vérification du bouton issu des composants du plugin : ajout/retrait du favori, conservation après un arrêt/redémarrage simulé, maintien de la sélection des raccourcis et de l’état OFF durant la bascule du favori.
- Régénération de l’aperçu interactif ; ses contrôles Vencord sont simulés.
- Comparaison des fichiers préparés et publiés et vérification de chaque fichier du paquet ZIP.

La construction des six composants Vencord mentionnée pour 0.2.0 n’a pas été relancée pour 0.2.2. L’affichage de l’étoile, le tri dans la vraie liste et la conservation après redémarrage de Discord restent à vérifier dans une session Discord réelle.

## Mise à jour 0.2.3 — conflits du raccourci global

L’utilisateur a confirmé l’affichage et le fonctionnement apparent de 0.2.2 dans Discord. Cette confirmation ne constitue pas un essai de 0.2.3.

- Compilation du TSX complet et 133 vérifications simulées réussies : les 85 vérifications existantes et 48 nouvelles vérifications des conflits.
- Combinaisons complètes, ordre différent des touches, alias, doublons, modificateurs gauche/droit, clavier/souris, pavé numérique et données malformées.
- Raccourcis actifs, désactivés, décochés, plusieurs actions sur une combinaison et entrées gérées par Discord présentes dans son magasin.
- Ajouts, suppressions, modifications de touche/action/activation dans les deux ordres de notification native/Discord ; actualisation du composant ouvert et vérification du secours périodique si une notification est manquée.
- Alerte pendant l’enregistrement, enregistrement malgré un conflit, annulation, réinitialisation F13, retour au précédent raccourci après erreur native, fermeture des paramètres et arrêt/redémarrage simulé.
- Maintien de ON/OFF, de la sélection et du favori ; la détection et l’affichage ne modifient aucun raccourci Discord pour résoudre un conflit.

L’alerte compare les combinaisons présentes dans le magasin de raccourcis Discord. Elle ne couvre pas les raccourcis d’autres applications ni les raccourcis fixes absents de ce magasin. La vérification complète des types et la construction des six composants Vencord n’ont pas été relancées pour 0.2.3, car les dépendances de l’installation source initiale ne sont plus disponibles. Le rendu réel de l’alerte doit être vérifié dans Discord après installation.

Essai conseillé : enregistrer temporairement la même touche qu’un raccourci Discord existant, vérifier son action dans l’alerte, changer ou supprimer ce raccourci Discord, puis revenir à F13. Essayer également une action désactivée dans Discord et une action décochée dans ShortcutToggle.

## Mise à jour 0.2.4 — diagnostic Stream Deck

- Compilation du TSX complet et 159 vérifications simulées réussies : les 133 précédentes et 26 vérifications du diagnostic et de sa durée de vie.
- Connexion temporaire distincte de la liaison principale, réponse getState reconnue, envoi de l’état actuel et absence de bascule ON/OFF pendant la vérification.
- Connexion inaccessible, silence, messages invalides/inconnus, interruption, échec de création/envoi, délai de cinq secondes et résultat affiché dans les composants.
- Protection contre les clics répétés et les événements tardifs, annulation lors de désactivation/reconnexion/arrêt, conservation de la sélection et nettoyage des ressources.
- Reprise d’une connexion principale bloquée, reconnexion automatique après erreur même si close échoue, heures de contact et distinction entre succès du diagnostic et liaison principale déconnectée.
- Compagnon Stream Deck et installateur 0.1.2.0 inchangés ; protocole local existant conservé. La démonstration permet de simuler un compagnon disponible, inaccessible ou sans réponse compatible.

Ces tests utilisent des WebSockets et modules Discord simulés. La compilation complète de Vencord et le test du diagnostic dans Discord avec l’application Stream Deck réelle n’ont pas été effectués pour 0.2.4. Le diagnostic vérifie un échange compatible et l’envoi de l’état ; il ne confirme pas à lui seul le fonctionnement de la touche physique.

Essai conseillé : lancer la vérification avec Stream Deck ouvert, fermer Stream Deck et refaire le test, puis le relancer et vérifier la reconnexion et le bouton physique. Le test doit conserver l’état ON/OFF et la sélection des raccourcis.

## Mise à jour 0.2.5 — notification de nouvelle version

- Compilation du TSX complet et 203 vérifications simulées réussies : les 159 précédentes et 44 vérifications de mise à jour.
- Comparaison des versions numériques, préversions, identifiants numériques longs, métadonnées de construction, tags invalides et publications en brouillon.
- Notification unique, cache entre redémarrages, vérification quotidienne, désactivation de l’automatisme, vérification manuelle et nouvelle notification pour une nouvelle version ; une publication inférieure à une version déjà annoncée ne provoque pas une nouvelle alerte.
- Lien de la carte et de la notification restreint au dépôt, refus des URL/titres fournis par l’API, requête sans credentials, cookies ou données Discord.
- Erreurs HTTP/réseau/JSON, délai de dix secondes, clics répétés, réponses tardives, arrêt/redémarrage, réactivation pendant une requête et horodatage futur invalide.
- Maintien de ON/OFF et de la sélection ; les vérifications consultent uniquement les métadonnées des publications et n’installent aucun code.

Les réponses réseau et notifications sont simulées dans ces tests. La collection publique réelle de publications GitHub a été consultée pour confirmer la présence des tags et préversions existants. La requête depuis le vrai client Discord, l’affichage/clic de la notification Vencord et la compilation complète de Vencord n’ont pas été testés pour 0.2.5.

Essai conseillé après installation : cliquer sur **Vérifier les mises à jour** et vérifier l’état « Aucune version plus récente disponible » pour 0.2.5, puis essayer avec la vérification automatique désactivée. Une notification réelle de nouveauté pourra être vérifiée après la publication d’une version supérieure.

## Mise à jour 0.2.6 — fiabilité du compagnon Stream Deck

- Compilation du TSX complet et **238 vérifications simulées réussies** : les 203 précédentes et 35 vérifications du compagnon, de son affichage et de l’échange avec le module Vencord compilé.
- Connexion sans état, état invalide, diagnostic séparé, session de contrôle stable, plusieurs boutons, disparition du client et reprise par un autre client valide.
- Commande unique en attente, confirmation, expiration sans répétition de la commande, erreurs d’envoi, absence de pong, absence de réponse d’état, messages tardifs et arrêt.
- Ordre des affichages asynchrones, disparition/réapparition d’une touche pendant un affichage, changements de page, erreur d’affichage et nouvel essai.
- Reprise du serveur après indisponibilité du port, ignorance des événements d’un ancien serveur et conservation des identifiants du composant/de l’action.
- Vérification sémantique TypeScript du plugin contre l’installation Vencord disponible et ses déclarations globales.
- Vérification TypeScript du compagnon contre le SDK Elgato installé, construction Rollup et création de l’installateur **0.1.3.0** avec le CLI officiel Elgato, sans erreur.

Les connexions, modules Discord et boutons sont simulés dans les tests de comportement. La construction des six composants Vencord n’a pas été relancée pour 0.2.6. L’installation Discord/Stream Deck active n’a pas été modifiée ; le test des touches physiques et du rendu dans les applications réelles reste à effectuer après la mise à jour des deux composants. Voir les étapes dans [STREAM_DECK.fr.md](STREAM_DECK.fr.md).

## Mise à jour 0.2.7 — panneau et distribution du compagnon

- Compilation du TSX complet et **286 vérifications simulées réussies** : les 238 précédentes et 48 tests des versions du compagnon, du cache, des préférences, des métadonnées, des erreurs/délais/annulations et du protocole entre le panneau et le SDK.
- Vérification sémantique du plugin avec Vencord, TypeScript du compagnon avec le SDK Elgato et construction Rollup réussies.
- Validation officielle du manifeste, du lien GitHub et des fichiers du panneau ; création de l’installateur **0.1.4.0** réussie. L’installateur doit correspondre au dossier source compilé et au descripteur publié.
- La version installée provient des informations fournies par Stream Deck, sans lecture du manifeste protégé à l’exécution. Le code ne modifie pas ses fichiers distribués et ne lance pas d’installation automatique.
- Visuels Marketplace originaux en anglais produits aux dimensions demandées ; présentation et guide de soumission préparés.

Les tests du panneau utilisent un DOM/WebSocket simulé. Le navigateur de l’application n’a pas permis de tester les aperçus locaux ; le rendu réel du panneau et du lien dans les préférences doit être vérifié dans Stream Deck. Aucune installation active ni compte Elgato n’a été modifié. Les visuels sont des illustrations de fonctions, pas une preuve d’utilisation réelle. Le produit n’est pas encore soumis ou approuvé par Marketplace.

Essai conseillé : installer le compagnon, sélectionner une touche, vérifier la version 0.1.4.0 et les liens, rechercher les mises à jour, désactiver la recherche quotidienne et redémarrer Stream Deck pour confirmer sa conservation. Essayer aussi la reconnexion et les touches physiques décrites dans le guide.
