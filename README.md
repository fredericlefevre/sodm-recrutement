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
| `HOST` | `127.0.0.1` | Interface réseau |
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

`npm test` exécute cinq tests d’intégration avec de vraies requêtes HTTP et des bases isolées : parcours offre/candidature/statut, validation des formulaires, protection de l’administration, conservation des données après redémarrage et pages/erreurs HTTP. Aucun test ne modifie la base de développement.

Vérification manuelle : créer une offre dans l’espace équipe, ouvrir `/carrieres`, postuler sur cette offre, revenir dans l’espace équipe et recharger la page, rechercher le candidat puis enregistrer son statut et ses notes.

Le développement cloud utilise le dépôt existant dans `/workspace/sodm-recrutement` ; aucun worktree supplémentaire n’est nécessaire. Les processus doivent être relancés dans une nouvelle tâche, même si les fichiers et la base sont conservés.
