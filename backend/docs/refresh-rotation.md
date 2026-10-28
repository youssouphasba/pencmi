# Rotation des refresh tokens

## Règles backend

Chaque token valide est consommé exactement une fois. La transaction PostgreSQL
en isolation `ReadCommitted` verrouille d’abord la session par mise à jour
conditionnelle, puis vérifie le hash, le propriétaire, la session et les
expirations. La consommation conditionnelle et l’insertion du successeur
appartiennent à la même transaction. Un échec d’émission annule la consommation.

- `consumedAt` signale une consommation par rotation.
- `revokedAt` signale une révocation, indépendamment de la rotation.
- `expiresAt` et l’expiration JWT déterminent l’expiration.
- `parentTokenId`, unique et référencé par clé étrangère, limite chaque parent
  à un seul successeur. Aucun token brut n’est conservé en base.

Un token enregistré, encore valide et non révoqué, mais déjà consommé,
déclenche une révocation de sa session et des tokens de cette session.
La transaction est validée avant l’erreur HTTP 401 : lever l’erreur à l’intérieur
annulerait la révocation. Les autres sessions du même compte sont préservées.
Un token inconnu, expiré, révoqué ou lié à une autre session est simplement
refusé. Les contrôles du compte actif, non supprimé, du rôle actuel et de la
session non révoquée de l’étape 4 sont conservés.

Deux requêtes backend concurrentes avec le même token ne peuvent pas émettre
deux successeurs. La première peut réussir ; la seconde détecte le rejeu et
révoque la session, y compris les tokens émis par la première. Il n’existe
aucune fenêtre de grâce acceptant un ancien token. La coordination frontend
est donc indispensable pour éviter les doubles envois légitimes.

## Coordination frontend

`auth/auth.js` et `admin/admin.js`, les deux points de renouvellement existants,
utilisent `auth/token-session.mjs` :

1. Une promesse partagée regroupe les renouvellements d’un même onglet.
2. Web Locks sérialise les renouvellements entre onglets de la même origine.
3. IndexedDB conserve les empreintes SHA-256 et l’état des tentatives, sans
   tokens bruts. Une écriture durable précède l’envoi réseau. Les empreintes
   des tentatives terminées sont conservées pour reconnaître un onglet ancien.
4. Un onglet dont `localStorage` n’est pas encore actualisé ne renvoie jamais
   un token dont une tentative est déjà enregistrée. Il attend les nouveaux
   credentials jusqu’à 1,5 seconde, puis propose une reconnexion si nécessaire.
5. Une réponse 401 tardive réutilise les credentials déjà remplacés. Une réponse
   de refresh tardive ne remplace pas un autre login et ne restaure pas une
   session effacée. Le contrôle est répété après lecture du corps HTTP.
6. L’installation des tokens après login ou inscription utilise le même verrou.
   Les anciennes empreintes sont marquées comme remplacées pour qu’un onglet
   avec une vue de stockage ancienne ne restaure pas le compte précédent.

Les autres consommateurs API existants n’envoyaient pas de refresh ; aucun
nouveau mécanisme concurrent n’y est ajouté. Les gardes partenaires hôteliers
et l’authentification `X-API-Key` ne changent pas.

HTTPS est requis en production. `localhost` permet les essais locaux. Si
Web Locks, IndexedDB ou Web Crypto sont indisponibles, aucun refresh n’est
envoyé : une reconnexion est proposée. Il n’existe pas de verrou simulé par
un bail `localStorage`, qui ne garantirait pas l’exclusion mutuelle. Deux
origines différentes ne partagent pas de stockage ni de verrou ; elles ne
doivent pas se transmettre manuellement les mêmes credentials.

## Réseau et données saisies

Un navigateur explicitement hors ligne n’envoie pas de requête ; un essai reste
possible après retour du réseau. Une requête envoyée mais non confirmée
(erreur réseau, délai de 15 secondes, erreur serveur, réponse incohérente)
laisse une tentative incertaine. Le frontend conserve les credentials et ne
renvoie pas automatiquement le même token : le serveur pourrait déjà l’avoir
consommé. Si aucun autre onglet ne fournit les credentials mis à jour, une
reconnexion devient nécessaire, sans révocation générale du compte.

Un refresh explicitement refusé avec HTTP 401 efface uniquement les credentials
locaux correspondants et le cache d’identité. Les formulaires et brouillons
non sensibles ne sont pas effacés. La mémoire IndexedDB ne contient que des
empreintes, des identifiants de tentative aléatoires et leur état. Sa purge
automatique n’est pas implémentée ; un quota épuisé bloque le refresh en sécurité.

Les tokens restent dans `localStorage`, comme avant : la protection contre
l’exécution de JavaScript malveillant reste importante. Le passage à des
cookies HttpOnly constitue une évolution distincte.

## Déploiement

1. Déployer d’abord le frontend coordonné avec le backend de l’étape 4.
   Les scripts HTML sont versionnés `20261028-rotation`. Servir les modules
   `.mjs` avec un type JavaScript et éviter un cache permanent des pages HTML.
   Faire recharger les onglets déjà ouverts : un ancien script en mémoire ne
   peut pas être remplacé par le seul déploiement des fichiers.
2. Appliquer `npm run prisma:deploy` depuis `backend`. La migration
   `20261028010000_refresh_token_rotation` ajoute uniquement des champs
   nullables, un index unique et une clé étrangère. Les tokens existants
   restent non consommés et valides selon les contrôles de l’étape 4.
3. Exécuter `npm run prisma:generate`, puis `npm run build`.
4. Déployer le nouveau backend sans mélanger durablement anciens et nouveaux
   processus sur `/auth/refresh`. Suspendre brièvement le routage de cet
   endpoint pendant le remplacement si le déploiement utilise plusieurs
   versions en parallèle. La migration doit précéder le démarrage du nouveau
   code ; un push Git ne garantit pas cet ordre dans Railway.
5. Vérifier login, rotation, rejeu, déconnexion et navigation multi-onglets.
   Ne pas revenir à un backend ignorant `consumedAt` après activation : cela
   rendrait à nouveau réutilisables des tokens consommés. Privilégier une
   correction conservant ces contrôles.

Aucune révocation globale n’est nécessaire à la migration. Des onglets restés
sur l’ancien frontend peuvent néanmoins provoquer un rejeu et la révocation
de leur session ; ce risque impose le déploiement préalable du frontend.

## Vérifications reproductibles

- Backend : `node node_modules/jest/bin/jest.js --runInBand`, depuis `backend`.
- Frontend : `node --test tests/auth-token-session.test.mjs`, depuis la racine,
  après installation des dépendances de développement de `backend`.
- Navigateur réel : définir `PENCMI_PLAYWRIGHT_MODULE` avec le chemin du module
  Playwright installé, puis exécuter
  `node --test tests/auth-token-session.browser.test.mjs`. Le test utilise
  Edge headless, un profil isolé, deux onglets et un serveur local de test
  n’exposant que les ressources prévues. Aucune API de production n’est appelée.
- PostgreSQL : fournir explicitement `TEST_DATABASE_URL` vers une base de test
  déjà migrée dont le nom contient `test`, puis exécuter
  `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/auth/refresh-postgres.spec.ts`.
  Le test crée puis supprime uniquement son utilisateur et ses sessions de
  test, aux identifiants aléatoires. Il n’utilise jamais `DATABASE_URL` par défaut.

Lors de cette livraison, les tests backend et frontend et le test réel
multi-onglets Edge ont été exécutés. Le test PostgreSQL est ignoré en l’absence
de `TEST_DATABASE_URL`. Les tests transactionnels Jest utilisent sinon une
simulation Prisma sérialisée ; ils ne remplacent pas une validation des verrous
et de la migration sur PostgreSQL réel.

## Résultats de cette livraison

- Backend : 161 tests réussis ; 1 test PostgreSQL ignoré faute de TEST_DATABASE_URL.
- Frontend : 21 tests réussis.
- Edge réel : 1 test multi-onglets réussi (24 requêtes, 1 seul refresh).
- Build NestJS et validation du schéma Prisma réussis.
- Aucune migration exécutée sur une base réelle pendant cette livraison.

## Fichiers modifiés

Liste exhaustive de cette étape :

- admin/admin.js
- admin/annonceurs/index.html
- admin/contacts/index.html
- admin/email-logs/index.html
- admin/index.html
- admin/listings/hotels/index.html
- admin/listings/immobilier/index.html
- admin/listings/index.html
- admin/listings/voitures/index.html
- admin/listings/voyages/index.html
- admin/messages/index.html
- admin/notifications/index.html
- admin/settings/index.html
- admin/statistiques/index.html
- admin/users/index.html
- admin/validation/index.html
- auth/auth.js
- auth/token-session.mjs
- backend/docs/refresh-rotation.md
- backend/docs/session-security.md
- backend/package-lock.json
- backend/package.json
- backend/prisma/migrations/20261028010000_refresh_token_rotation/migration.sql
- backend/prisma/schema.prisma
- backend/src/auth/auth.service.ts
- backend/src/auth/refresh-postgres.spec.ts
- backend/src/auth/session-security.spec.ts
- dashboard/index.html
- dashboard/profil/index.html
- dashboard/settings/index.html
- forgot-password/index.html
- login/index.html
- register/index.html
- reset-password/index.html
- tests/auth-token-session.browser.test.mjs
- tests/auth-token-session.test.mjs
