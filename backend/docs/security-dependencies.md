# Dépendances et HTTP : étape 12

Audit du 6 novembre 2026. Point de départ vérifié : `66fe5e6092db40a659014c7cf210b157873d5c99`, synchronisé avec `origin/main`. Les pièces jointes locales ne font pas partie du commit. Aucun module métier, formulaire frontend, compte ou réservation n'est modifié.

## Dépendances et exposition

| Paquet | Avant → après | Introduction / exposition | Correction |
| --- | --- | --- | --- |
| proxy-addr | 2.0.7 → 2.0.8 | Nest platform-express → Express → calcul de l'IP | Critique corrigée ; tests des sous-réseaux IPv4-mapped IPv6 et de X-Forwarded-For |
| body-parser | 2.3.0 → 2.4.0 | Express → corps JSON/formulaires HTTP | Élevée corrigée ; limites explicites et compression entrante refusée |
| qs | 6.15.3 → 6.17.1 | Express/body-parser, également Supertest en développement | Modérée corrigée ; formulaires bornés, requêtes GET conservées en mode simple |
| js-yaml | 5.1.0 → 5.5.0 | Swagger en runtime ; ESLint, Jest et Nest CLI en développement | Override vulnérable relevé ; contrat load/dump testé, aucun YAML utilisateur chargé par une route |
| deepmerge-ts | 7.1.5 → 8.0.2 | Prisma CLI → @prisma/config → chargement de configuration locale | Override limité à @prisma/config, graphe cyclique et vrai chargeur de configuration testés |
| prisma, @prisma/client, @prisma/config | 6.19.3 inchangé | Client SQL / outils de génération et de migration | Pas de migration vers Prisma 7, générateur et datasource conservés |

Les quatre correctifs HTTP/YAML sont compatibles avec les interfaces déjà utilisées. L'override **majeur** de deepmerge-ts est intentionnel et circonscrit : Prisma utilise `deepmerge` comme fusionneur de configuration ; les renommages de types et les changements de fusion des Map de la v8 ne sont pas utilisés dans la configuration du projet. Les tests vérifient fusion de données simples, non-mutation, cycles, chargement CommonJS réel via Prisma 6, génération, validation, migrations et schéma PostgreSQL isolé. Ce n'est pas un override aveugle de l'ensemble des consommateurs.

Références vérifiées : [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828), [js-yaml](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm), [qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) et [ruptures de la version 8](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0).

Mises à jour compatibles supplémentaires de développement : Handlebars 4.7.9 → 4.7.10, fast-uri 3.1.2 → 3.1.9, browserslist 4.28.4 → 4.29.5, baseline-browser-mapping 2.10.40 → 2.11.35, brace-expansion 1.1.15 → 1.1.21, 2.1.1 → 2.1.7 et 5.0.6 → 5.0.12 selon leurs branches. Le lockfile inclut leurs données de compatibilité navigateur et les dépendances requises par les correctifs (argparse 3.0.4, content-type 2.1.0, iconv-lite 0.7.3). Aucun `npm audit fix --force`, downgrade de Jest ou mise à jour majeure Nest n'est appliqué.

## Audits mesurés

| Commande / moment | Critiques | Élevées | Modérées | Faibles | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| `npm audit --omit=dev --json`, avant | 1 | 5 | 1 | 0 | 7 |
| `npm audit --omit=dev --json`, après | 0 | 0 | 0 | 0 | 0 |
| Audit complet intermédiaire après correction runtime | 1 | 3 | 14 | 2 | 20 |
| Audit complet après correctifs compatibles d'outillage | 0 | 0 | 13 | 2 | 15 |

Les 15 alertes restantes ne sont pas des faux positifs ni masquées. Elles concernent glob/minimatch et leurs chaînes Jest, Nest CLI et typescript-estree (13 modérées), ainsi que deepmerge et fork-ts-checker-webpack-plugin (2 faibles). **deepmerge n'est pas deepmerge-ts** : le second est corrigé, le premier subsiste dans l'outillage.

Particularité vérifiée dans l'image Railway : `NPM_CONFIG_PRODUCTION=false` provoque `include=dev`, qui prime sur `--omit=dev`. Un audit distant naïf inclut donc les 15 alertes d'outillage. Le contrôle runtime réellement exécuté utilise, uniquement pour ce processus Linux, `env -u NPM_CONFIG_PRODUCTION -u npm_config_production npm audit --omit=dev --json` : **exit 0, zéro alerte**. L'audit complet reste à 15 ; aucune configuration Railway persistante n'est modifiée et aucune alerte n'est supprimée du rapport.

Les avis restants portent sur [glob et l'annulation de parcours](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch et l'amplification de motifs](https://github.com/advisories/GHSA-g3hv-75wg-m249) et [deepmerge et les prototypes](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Leur entrée est la configuration ou les fichiers des outils de build/test, pas une route publique identifiée. Les outils peuvent cependant rester présents dans l'image Railway de build : le classement npm `dev` ne signifie pas qu'ils ont été supprimés physiquement. Les builds doivent utiliser une source et des configurations de confiance. Les suppressions de ces dernières alertes proposées par npm impliquent notamment Nest CLI 12, un changement majeur de minimatch/glob ou un downgrade incompatible de l'outillage ; elles ne sont pas forcées dans ce lot. Aucun score de sécurité absolue n'est revendiqué.

## Politique HTTP

- `TRUSTED_PROXY_CIDRS` : liste d'IP/CIDR explicites, vide par défaut (`trust proxy=false`). Ni `true`, ni nombre de hops, ni wildcard, ni CIDR universel ne sont acceptés. Une notation IPv4-mapped doit couvrir son marqueur IPv6. Aucune plage Railway n'est devinée ou ajoutée automatiquement. L'IP client n'est utilisée que si le pair immédiat est explicitement fiable ; sinon la limite utilise l'IP du socket, comme auparavant. Derrière un proxy non déclaré, plusieurs clients peuvent donc partager un quota : il faut obtenir les plages fiables avant de les configurer.
- `HTTP_BODY_LIMIT_BYTES` : 102400 par défaut, identique à la limite JSON historique, configurable entre 1024 et 1048576. Formulaires limités à 1000 paramètres et 8 niveaux. Le parsing multipart reste confié aux intercepteurs et quotas fichiers existants, pas à la limite JSON.
- Corps HTTP compressés gzip/deflate/Brotli refusés en 415 avant décompression. Les clients/partenaires doivent transmettre des corps non compressés ; aucune compression entrante n'est nécessaire dans les formulaires actuels. Corps trop volumineux : 413 ; syntaxe malformée : 400. Les erreurs ne reflètent pas le contenu soumis.
- CORS de production limité aux origines exactes de `CORS_ORIGINS`. Le frontend LAN déjà déclaré reste autorisé ; les autres adresses privées ne sont plus autorisées implicitement en production. Le mode développement conserve l'accès local. Aucune variable Railway de production n'est changée dans ce lot.
- Helmet, cookies signés, validation DTO stricte, throttling, JWT et permissions restent en place. Les tests HTTP utilisent les mêmes fonctions de configuration et les vrais guards ; seules les identités du test unitaire sont simulées, sans simuler la cryptographie des suites auth existantes.

## Reproduction

Versions observées en production avant modification : Node **22.23.4**, npm **10.9.9**. Node 22.23.4 est également vérifié dans la recette. Build Railway : installation du lockfile, `npm run build` ; pré-déploiement existant `npm run prisma:deploy` ; démarrage `npm run start:prod`.

Depuis `backend` :

```powershell
npm ci --include=dev
npm run prisma:generate
```

Commandes réelles supplémentaires :

```powershell
node node_modules/prisma/build/index.js validate
node --max-old-space-size=640 node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false
node node_modules/eslint/bin/eslint.js "src/**/*.ts"
npm run build
node --max-old-space-size=320 node_modules/jest/bin/jest.js --runInBand --globals '{"ts-jest":{"isolatedModules":true}}'
node --test scripts/security-dependencies.test.cjs scripts/audit-migrations.test.cjs scripts/database-fingerprint.test.cjs
npm audit --omit=dev --json
npm audit --json
```

Sondes distantes reproductibles : `node scripts/security-http-probe.cjs https://security-stage12-tests-<environnement>.up.railway.app/api/v1`. Le script refuse les URL de production. Il ne crée ni compte ni demande ; ses POST invalides sont refusés par le parseur avant tout service métier.

La génération du client après `npm ci` est obligatoire avant TypeScript. Les avertissements de dépréciation ts-jest sont conservés, pas masqués. Les tests navigateur nécessitent `PENCMI_PLAYWRIGHT_MODULE` pointant sur le runtime Playwright installé, puis `node --test --test-concurrency=1 tests/*.test.mjs` depuis la racine.

## Vérification et données

- `npm ci` exécuté, génération et validation Prisma réussies ; TypeScript strict, lint et build NestJS réussis avec les versions retenues.
- Backend local : **373 tests réussis, 32 ignorés**, dont les **23 nouveaux tests HTTP**. Les tests PostgreSQL ignorés localement sont exécutés en recette ; les totaux se recouvrent et ne s'additionnent pas.
- Recette finale `935205ed-f7f0-47eb-b1fa-f12a6e4469b1`, environnement `security-stage12-test` : **402 tests backend réussis, 3 ignorés**, 25 suites réussies. Inclut auth/JWT/rotation, support, partenaires hôteliers, immobilier, hôtels/allocations, véhicules et voyages/places concurrentes. Les trois tests ignorés concernent le navigateur immobilier Windows et deux accès R2 distants non configurés pour ce lot.
- **17 tests d'outils réussis** : audits/empreintes et six nouveaux contrats de dépendances, dont le véritable chargeur Prisma. Compilation réelle d'un template Handlebars avec échappement HTML également vérifiée. Le schéma isolé est `in_sync`, sept migrations existantes appliquées.
- Frontend : **50 tests réussis**, zéro échec, un parcours live de publication conditionnel ignoré dans ce lancement. Auth multi-onglets et navigateurs des quatre univers inclus. Les campagnes live métier complètes de publication ne sont pas répétées : aucun frontend ou service métier n'est modifié, et la sélection vise les dépendances et parseurs HTTP.
- **16 sondes HTTP réelles réussies** en recette : health, quatre modules publics, documents Swagger JSON/YAML 200 ; espaces privés et API partenaire sans clé 401 ; CORS autorisé 200 et refusé 403 ; corps volumineux 413, gzip 415, JSON invalide 400. Le serveur de recette démarre explicitement avec `NODE_ENV=production`, après les tests, pour vérifier cette politique CORS réelle.

La recette est empaquetée hors dépôt en copiant uniquement sources, schéma, migrations, scripts, tests et manifests, sans `.env`, uploads ou sauvegardes. Seuls les scripts npm de cette copie sont adaptés pour lancer la vérification d'identité du cluster, les migrations existantes, fixtures et tests avant le vrai démarrage. Les scripts build/start de production du dépôt ne sont pas remplacés par ce harnais. Les premières réponses 502 de recette pendant ce démarrage long ne sont pas comptées comme des sondes réussies ; les 16 sondes ci-dessus sont exécutées une fois le serveur prêt.

Contrôle post-push observé : déploiement Railway `0bcb33aa-31eb-4d8a-be84-f09a19f46f89`, commit de sécurité `ab4159bb1ea052ba729719ac051a6ef0e6c4143a`, statut **SUCCESS**. Les six contrats de dépendances sont aussi exécutés avec succès dans l'image de production. L'audit runtime distant corrigé de la particularité npm ci-dessus retourne zéro alerte. Health, quatre univers et Swagger YAML répondent 200 ; espaces privés 401 ; origine LAN déjà déclarée 200, autre origine privée 403, Helmet présent. Le schéma reste `in_sync`, les sept migrations et l'empreinte historique sont inchangés. Aucun POST métier ni création de données en production.

La recette, ses instances et ses services temporaires sont supprimés : l'inventaire Railway ne contient plus que l'environnement `production` et les services originaux `pencmi` et `Postgres`. Le CLI est relié de nouveau à `production/pencmi`. Les sauvegardes locales ne sont pas touchées. Un éventuel commit documentaire postérieur doit être distingué du commit backend effectivement contrôlé ci-dessus.

Pas de changement de `schema.prisma` ni de SQL de migration. Avant livraison, les sept migrations de production sont appliquées, checksums conformes, schéma `in_sync`. Empreinte historique en lecture seule : `ffe9fb9076fc43e14ca91e9ebb8daadf0d87f6a4d85479da34042146eee72752`. Les tests SQL utilisent exclusivement un nouveau cluster et une base `_test`. Aucun seed, reset ou test créant des données n'est lancé en production ; aucune récupération de DATABASE_URL ou des secrets de production n'est nécessaire.

## Retour arrière

En cas de défaut bloquant : conserver les données et migrations, interrompre le déploiement défectueux et sélectionner le déploiement Railway précédent, ou produire un commit de réversion ciblé des seuls fichiers de ce lot sur `main`. Aucun `migrate reset`, `db push`, SQL improvisé ou force-push. Comme le schéma et Prisma restent identiques, aucune restauration SQL n'est requise pour revenir au binaire précédent. Ce retour réintroduirait les dépendances vulnérables ; il reste une mesure d'urgence temporaire, suivie d'un correctif testé. Une erreur CORS doit d'abord être confrontée à la liste explicite des origines, sans réactiver un wildcard ou une confiance proxy universelle.
