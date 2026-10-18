# SODM Recrutement

Première version d’une application de recrutement en français, avec un espace équipe et un site carrières. Interface adaptée aux ordinateurs et aux téléphones, serveur Node.js et stockage SQLite persistant, sans dépendances applicatives externes.

## Démarrer

Prérequis : **Node.js 24 ou supérieur**, avec npm.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm start
```

Le serveur écoute sur la machine locale, port **3000**. L’espace équipe est servi au chemin `/` et l’espace carrières au chemin `/carrieres`. `npm run dev` redémarre le serveur quand les fichiers du serveur changent ; recharger le navigateur après une modification de l’interface.

## Fonctionnalités

- Tableau de bord : offres, candidatures, entretiens, recrutements et pipeline par étape.
- Création d’offres avec service, lieu, contrat et description ; affichage immédiat sur la page carrières.
- Site carrières : recherche des offres et formulaire de candidature avec nom, e-mail et message de motivation.
- Espace équipe : ajout manuel de candidats, recherche, filtre par statut, notes et suivi des étapes « À étudier », « Entretien », « Proposition », « Recruté », « Refusé ».
- Conservation des données dans `data/recrutement.sqlite`, fichier ignoré par Git.

Au premier démarrage, trois offres et cinq candidats **fictifs** sont créés. Les adresses `example.com` appartiennent aux profils de démonstration. Les données de démonstration ne sont pas réinsérées aux démarrages suivants.

## Configuration

| Variable | Valeur par défaut | Usage |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP |
| `HOST` | `127.0.0.1` en local, `0.0.0.0` sur Render | Interface réseau ; Render est détecté grâce à sa variable `RENDER=true` |
| `DB_PATH` | `data/recrutement.sqlite` dans le projet | Chemin de la base SQLite |
| `SEED_DEMO` | `true` | Mettre `false` pour initialiser une nouvelle base vide |
| `ADMIN_PASSWORD` | Non défini | Active la connexion HTTP Basic de l’espace équipe, identifiant `admin` |

Pour travailler sans données fictives et préserver la base de démonstration :

```sh
SEED_DEMO=false DB_PATH=data/recrutement-vide.sqlite npm start
```

`SEED_DEMO=false` ne supprime pas les données d’une base existante. Pour sauvegarder la base, arrêter le serveur, copier le fichier SQLite dans un emplacement protégé, puis redémarrer.

En développement local, l’espace équipe fonctionne sans mot de passe. Une écoute hors de la machine locale nécessite `ADMIN_PASSWORD` ; le serveur refuse de démarrer sans ce paramètre. Fournir ce mot de passe par un gestionnaire de secrets ou l’environnement du processus, jamais dans Git. Lorsqu’il est activé, le navigateur demande les identifiants sur l’espace équipe ; les offres et le dépôt de candidature restent accessibles sans connexion. Une mise en ligne doit utiliser HTTPS devant le serveur, protéger les données et prévoir la gestion des abus du formulaire public.

Cette version n’est pas encore déployée sur Internet. Elle ne comprend pas l’envoi d’e-mails, le téléversement de CV, les comptes individuels, la modification/suppression des offres ou la suppression des candidatures. La confirmation du formulaire indique seulement que la candidature est enregistrée.

## Vérification

`npm test` exécute huit tests d’intégration avec de vraies requêtes HTTP et des bases isolées : logo intégré au dépôt, import et conservation du logo, démarrage réseau sur Render sans variable HOST, parcours offre/candidature/statut, validation des formulaires, protection de l’administration, conservation des données après redémarrage et pages/erreurs HTTP. Aucun test ne modifie la base de développement.

## Ajouter le logo SODM

Le logo original est intégré au dépôt dans `public/SODM_logotype R100 seul baseline150.png`. Le site affiche automatiquement ce fichier dans les deux espaces, même avec une nouvelle base de données. Aucun accès SharePoint ni import manuel n’est nécessaire pour les visiteurs.

Dans l’espace équipe, cliquer sur **Importer le logo**, puis sélectionner l’image originale sur votre appareil (PNG, JPEG ou WebP, 2 Mo maximum). L’image est conservée sans redessin dans la base SQLite et affichée sur les deux espaces avec ses proportions d’origine. Recharger la page carrières si elle était déjà ouverte. Le bouton permet aussi de remplacer le logo. Sur Render gratuit, le logo peut être perdu avec le reste de la base temporaire ; il faudra alors l’importer à nouveau.

Un logo importé dans l’espace équipe est prioritaire sur celui du dépôt. Si cette importation disparaît avec la base temporaire, le logo du dépôt est à nouveau utilisé lorsqu’il est présent.

Vérification manuelle : créer une offre dans l’espace équipe, ouvrir `/carrieres`, postuler sur cette offre, revenir dans l’espace équipe et recharger la page, rechercher le candidat puis enregistrer son statut et ses notes.

Le développement cloud utilise le dépôt existant dans `/workspace/sodm-recrutement` ; aucun worktree supplémentaire n’est nécessaire. Les processus doivent être relancés dans une nouvelle tâche, même si les fichiers et la base sont conservés.

## Mettre en ligne sur Render

Le fichier `render.yaml` prépare un **Web Service gratuit de démonstration**, sans disque persistant. Trois offres et cinq candidats fictifs sont ajoutés lorsque la base temporaire est initialisée. Les modifications peuvent être perdues lors des redémarrages, mises en veille ou redéploiements. Utiliser uniquement des candidatures fictives. Le service gratuit peut se mettre en veille et prendre du temps à répondre au premier accès.

1. Se connecter à Render, puis choisir **New → Blueprint**.
2. Connecter GitHub et sélectionner `fredericlefevre/sodm-recrutement`, branche `main`. Autoriser l’accès à ce seul dépôt si possible.
3. Render lit `render.yaml`. Renseigner `ADMIN_PASSWORD` avec un mot de passe long et unique dans son formulaire sécurisé ; ne pas le publier dans GitHub ni le communiquer dans le chat.
4. Vérifier que le plan affiché est **Free**, sans disque payant, puis lancer le déploiement.
5. Attendre le statut **Live** et copier l’adresse HTTPS effectivement attribuée par Render. Aucun nom de domaine particulier n’est garanti à l’avance.

À cette adresse, le chemin `/` ouvre l’espace équipe : identifiant **admin**, mot de passe défini dans Render. Ajouter `/carrieres` à l’adresse pour ouvrir le site candidats. Des offres et profils de démonstration permettent de tester immédiatement.

Vérifier ensuite le parcours : créer une offre, envoyer une candidature fictive sur `/carrieres`, la retrouver côté équipe et modifier son statut. Un visiteur sans connexion ne doit pas pouvoir accéder à `/api/data`. La base SQLite est située dans `/tmp/sodm-recrutement.sqlite` sur un stockage temporaire : sa conservation n’est pas garantie.

Pour une création manuelle via **New → Web Service**, sélectionner ce dépôt et la branche `main`, le runtime Node et le plan **Free**. Utiliser `npm ci --ignore-scripts --no-audit --no-fund && npm test` comme commande de construction et `npm start` comme commande de démarrage. Dans **Environment**, ajouter `NODE_VERSION=24.19.0`, `HOST=0.0.0.0`, `SEED_DEMO=true`, `DB_PATH=/tmp/sodm-recrutement.sqlite` et un `ADMIN_PASSWORD` personnel. Ne pas ajouter de disque. Si un service payant existe déjà, ce fichier ne modifie pas automatiquement son abonnement : vérifier son plan dans Render avant de poursuivre.

Cette configuration fournit une première mise en ligne avec une connexion administrateur partagée. Les fonctions absentes et les précautions de mise en ligne indiquées plus haut restent applicables.
