# Recette HTTPS isolee

Verification du 10 novembre 2026. Environnement Railway temporaire
`pencmi-recette-20261110`, cree vide, sans duplication des donnees de production.

- `Postgres-B4wL`, `preview-api`, `preview-web` : deploiements SUCCESS.
- API sans domaine public, accessible via le proxy prive du frontend.
- Acces frontend protege par cle et cookie HttpOnly, Secure, SameSite=Strict.
- Reponses de recette noindex et no-store.
- Aucun secret de production copie. Emails non configures ; processeur
  d'alertes sauvegardees desactive.
- Stockage local temporaire : les uploads ne sont pas garantis apres
  redeploiement. Ne pas utiliser cette recette comme sauvegarde de fichiers.

## Verification executee

- Acces autorise, sante API et cinq pages publiques : HTTP 200.
- API sans cle et administration sans JWT : HTTP 401.
- Cle incorrecte : HTTP 403 ; fichiers backend et `.env` : HTTP 404.
- Navigateur Chrome : accueil et quatre univers a 360, 390 et 1440 px,
  sans debordement horizontal et sans appel au backend de production.
- PostgreSQL local isole `pencmi_step15_test` : suites
  `admin-moderation-postgres.spec.ts` et `client-requests-postgres.spec.ts`,
  25 tests reussis. Premier lancement sans base disponible en echec ;
  resultat ci-dessus obtenu apres redemarrage et nouvelle execution complete.
- Verification syntaxique du serveur frontend et `git diff --check` reussis.

Les tests metier PostgreSQL ont ete executes localement, pas contre Railway.
La recette distante est vide : les comptes de production n'y existent pas.
Les envois d'emails et la persistance des photos apres redeploiement ne sont
pas valides par cette recette.

## Acces et exploitation

Le fichier d'acces hors depot est chiffre par Windows DPAPI. Utiliser
`scripts/show-preview-access.ps1 -CredentialPath <chemin-clixml>` sur le
compte Windows qui l'a cree pour copier la cle dans le presse-papiers.
Ne pas ajouter ce fichier, des exports de variables ou des credentials au Git.

Les Dockerfiles sont destines a des contextes de build prepares par liste
explicite de fichiers suivis par Git : backend seul pour l'API, ressources
publiques et serveur frontend pour le web. Ne pas envoyer le depot complet,
les fichiers `.env`, les uploads ou les pieces jointes.

Attendre que l'API dispose de son domaine prive avant le demarrage du web.
Verifier la reference de base et l'environnement avant toute commande Railway.
La production et son deploiement n'ont pas ete modifies. Les services de
recette restent actifs pour consultation et peuvent occasionner des frais ;
prevoir leur suppression a la fin de la recette, avec accord de l'utilisateur.
