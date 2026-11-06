# Etape 17 - Profil, parametres et securite du compte

Base de travail : `3c3bac0f2d0e13468bffd03a4be970ddfd920b59`.

## Parcours actifs

- `GET /users/me` expose exclusivement le profil du compte authentifie et ses indicateurs de verification reels.
- `PATCH /users/me` accepte seulement `firstName`, `lastName`, `city`. Une valeur omise reste inchangee ; une chaine vide ou `null` efface explicitement le champ. Normalisation Unicode NFC et espaces, limites 100/100/150 caracteres, refus des controles et champs inconnus. Email, telephone, role, statut et verifications ne sont pas modifiables par ce contrat.
- `POST /users/me/avatar` et `DELETE /users/me/avatar` sont relies au stockage existant. Multipart limite a un fichier de 5 Mo sans champ supplementaire. Verification du contenu JPEG/PNG/WebP, decodage Sharp, maximum 25 millions de pixels, refus des animations. Reencodage WebP sans metadonnees, dimensions maximales 1024 x 1024 sans recadrage ni agrandissement.
- Remplacement et suppression de la reference avatar serialises par verrou PostgreSQL sur le proprietaire. La reference est validee avant nettoyage de l'ancien fichier ; un echec transactionnel nettoie le nouveau binaire. Le nettoyage ne retire pas une ressource d'un autre compte, un logo ou une image encore referencee. Un echec de nettoyage physique est journalise sans secret : sa reprise reste manuelle, aucun worker de purge n'a ete ajoute.
- Le pipeline d'images publiques est partage avec les logos professionnels. Les anciennes references SVG/GIF restent en base, mais ces formats ne sont plus servis comme images de profil ; leur remplacement par une image autorisee est necessaire.
- `POST /auth/change-password` exige le mot de passe actuel et un nouveau mot de passe different : minimum 12 caracteres, minuscule, majuscule, chiffre et symbole ; maximum 72 octets UTF-8 pour bcrypt. Hash bcrypt cout 12, changement et revocation de toutes les sessions/refresh tokens dans une transaction. Un login concurrent ne peut conserver l'ancien mot de passe apres cette transaction.
- Une notification interne de changement de mot de passe et une entree d'audit sans secret sont creees dans la meme transaction. Le texte initial est centralise dans `ACCOUNT_SECURITY_COPY`, remplacable par le futur fournisseur editorial. Aucun email n'est annonce ou envoye par ce parcours.
- `GET /auth/sessions` fournit une liste paginee des seules sessions non revoquees du compte, sans IP ni jeton. `DELETE /auth/sessions/:id` revoque une session propre et ses refresh tokens ; `DELETE /auth/sessions/others` preserve la session courante. Les protections JWT et rotation existantes restent actives.
- Les interfaces client et dashboard reutilisent les modules profil/parametres. Les saisies sont conservees sur erreur, les commandes sont bloquees pendant leur execution, les contenus variables utilisent le DOM texte. Les alertes et notifications renvoient aux services existants.
- La page Contact utilise le service de tickets existant pour les comptes connectes. Confirmation uniquement apres creation reelle ; historique limite visuellement aux 20 dernieres demandes du compte. Sans connexion, aucun envoi fictif n'est propose.

## Limites explicites

- Recuperation/reinitialisation par email ou SMS non implementee : endpoints `forgot-password` et `reset-password` repondent HTTP 501, interfaces informatives sans faux formulaire. Le support authentifie ne constitue pas un mecanisme de recuperation pour un compte inaccessible.
- Pas de verification email/telephone, suppression automatique de compte, preference linguistique persistante ni interrupteur global de confidentialite/email sans consommateur reel.
- Limitation des essais de changement de mot de passe : 5 par 15 minutes par le throttler existant. Son stockage est local a l'instance, pas une garantie distribuee entre plusieurs replicas.
- Les jetons restent dans le stockage frontend existant ; aucune migration de transport d'authentification n'est comprise dans cette etape.
- Les tests de fichiers utilisent un stockage local temporaire isole. Les deux tests distants R2 exigent des credentials de recette et restent ignores sans ceux-ci. Aucun upload de test sur le stockage de production.
- Aucune migration Prisma ni modification des variables Railway necessaire. Ne pas activer `SAVED_ALERTS_PROCESSOR_ENABLED` dans ce lot.

## Validation

Resultats executes le 6 novembre 2026 :

- Backend : 34 suites reussies, 567 tests reussis, 2 tests distants R2 ignores dans une suite conditionnelle.
- Frontend : 53 tests reussis, 1 ancien test de recette distante voyages ignore faute de configuration de cette recette. Les parcours PostgreSQL locaux sont verifies par les suites backend.
- Outils migrations, empreintes et dependances : 17 tests reussis.
- TypeScript, ESLint, build NestJS, generation et validation Prisma : reussis.
- Audit local en lecture seule : 7 migrations appliquees, aucun probleme, schema conforme.
- Verification Railway avant deploiement : processeur d'alertes desactive. Aucune variable modifiee.

Les suites `account-profile.spec.ts` et `account-security-postgres.spec.ts` couvrent validation, isolation HTTP, fichiers reels, rollback et concurrence PostgreSQL, sessions, changement de mot de passe, limitation des essais et navigateur Edge aux largeurs 360, 390, 768 et 1280.

La base locale de test est exclusivement sur loopback, avec un nom se terminant par `_test`. Les utilisateurs, fichiers et tickets ephemeres sont nettoyes apres les tests ; aucune connexion a la base Railway de production.

Commandes de verification depuis `backend`, avec `DATABASE_URL` et `TEST_DATABASE_URL` diriges vers cette base isolee :

```powershell
node node_modules/jest/bin/jest.js --runInBand
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false
node node_modules/eslint/bin/eslint.js 'src/**/*.ts'
node node_modules/@nestjs/cli/bin/nest.js build
node node_modules/prisma/build/index.js validate
```

Depuis la racine : `node --test --test-concurrency=1 tests/*.test.mjs`.
Le navigateur utilise `PENCMI_PLAYWRIGHT_MODULE` pointant vers l'installation locale de Playwright.

Deploiement : push sur `main`, attendre le deploiement Railway correspondant exactement au SHA, verifier la sante et les refus sans authentification. Les parcours authentifies de modification sont valides sur recette locale, pas executes sur les comptes de production.
