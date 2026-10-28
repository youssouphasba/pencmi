# Railway : diagnostic et synchronisation des migrations — étape 6.2

## État vérifié le 28 octobre 2026

**Aucune migration appliquée pendant cette intervention. Aucune donnée modifiée. Déploiement non validé.**

La CLI Railway authentifiée a permis de vérifier :

| Élément | Valeur |
| --- | --- |
| Projet | `earnest-generosity` |
| Projet ID | `9447f5a9-a84e-4a15-9e41-a92be3e69c06` |
| Environnement | `production` |
| Backend | `pencmi` — `5766c5df-d9b0-4784-a65b-aec2980abdd5` |
| Base | `Postgres` — `8651dbb0-0ab9-4fce-b5cc-caf178153e56` |
| Volume | `postgres-volume` — `19759dd6-75ab-4d15-ab97-2f2c7c98b5f4` |
| Montage PostgreSQL | `/var/lib/postgresql/data` |
| Version PostgreSQL | `18.6` |

Les variables résolues du service backend ont été comparées en mémoire à celles du service Postgres : même hôte privé, port, base et identifiants. La connexion publique Postgres utilisée uniquement pour la lecture locale correspond également à cette base et à ces identifiants. Une requête en lecture seule depuis le conteneur backend actif a confirmé son commit, sa connexion interne, sa base et son historique de migrations. Le `system_identifier` du cluster et le nom de base ont ensuite été comparés à ceux de la connexion publique : ils correspondent tous les deux. La cible auditée est donc bien celle du backend actif, pas seulement une ancienne configuration locale. Les secrets n’ont été ni affichés ni enregistrés dans ce rapport.

Le dernier déploiement réussi observé est `375de715-5abe-4b03-9484-08c826e2ee07`, commit `39b6e6902a75f9b9e37e72f42ba8b981274f2112`, source `youssouphasba/pencmi`, branche `main`, racine `/backend`. Le commit `9ff420f104460676475b430698f49cd761b81460` était en file d’attente lors de la vérification. Ce sont des observations datées, pas une garantie de l’état futur du service.

Dans le manifeste du déploiement réussi, aucune commande de pré-déploiement ni healthcheck n’est définie. La commande de démarrage est détectée automatiquement. Aucun paramètre Railway n’a été modifié, hormis l’association locale de la CLI au projet pour l’audit.

## Historique et schéma réel

L’audit SQL a été exécuté dans une transaction `READ ONLY`. La table `_prisma_migrations`, les colonnes, tables, enums, contraintes et index ont été inspectés. Une comparaison Prisma indépendante entre la datasource et `schema.prisma` a été exécutée, sans appliquer le SQL généré.

| Migration | Historique | Effets observés |
| --- | --- | --- |
| `20260626030000_init` | Appliquée le 26 juin 2026 | Checksum conforme au fichier versionné |
| `20260626170000_advertiser_reviews` | En attente | Table, enum, index et clés étrangères absents |
| `20261028000000_hotel_api_key_active` | En attente | Colonne `HotelApiKey.active` absente |
| `20261028010000_refresh_token_rotation` | En attente | Colonnes, index unique et clé étrangère absents |

`RefreshToken.consumedAt` et `RefreshToken.parentTokenId` sont absents. Aucun enregistrement de migration échouée ou inachevée, aucun index invalide détecté. Aucun effet partiel des trois migrations en attente n’est présent. La comparaison Prisma ne relève que les différences couvertes par ces trois migrations ; aucune autre dérive détectée dans les objets gérés par Prisma. Cela ne remplace pas un audit des extensions, privilèges, triggers ou fonctions PostgreSQL non représentés par Prisma.

## Revue des migrations SQL

### Avis annonceurs

Création d’un enum et d’une nouvelle table vide, trois index et deux clés étrangères vers `User`. Pas de suppression ni de modification des données existantes. Les actions de clés étrangères ne concernent que les futurs avis : suppression des avis lors d’une suppression physique de l’annonceur, auteur anonymisé par `SET NULL` lors d’une suppression physique du rédacteur. La migration ne supprime aucun utilisateur.

Risque opérationnel : verrous de création des clés étrangères ; la table et l’enum ne doivent pas déjà exister. L’audit confirme leur absence. L’application des règles de notation reste celle du service existant, sans ajout de logique métier.

### Activation des clés partenaires

Ajout de `active BOOLEAN NOT NULL DEFAULT true`. Les clés existantes héritent de `true` ; leur éventuelle révocation continue d’être contrôlée indépendamment par le guard existant. Aucun hash ni secret n’est réécrit. Un verrou DDL est nécessaire, même si l’ajout avec valeur constante évite normalement la réécriture complète de la table sur cette version de PostgreSQL.

### Rotation des refresh tokens

Ajout de deux colonnes nullables, d’un index unique sur `parentTokenId` et d’une clé étrangère auto-référente. Les anciennes lignes conservent des valeurs `NULL` : pas de révocation globale des sessions. L’unicité laisse coexister plusieurs valeurs `NULL`. L’index est créé sans `CONCURRENTLY` et peut bloquer les écritures sur `RefreshToken` pendant sa construction. Le volume et la durée réelle du verrou doivent être évalués avant exécution.

Les fichiers SQL existants ne sont pas modifiés. Ne pas les remplacer par du SQL improvisé ni modifier leurs checksums. En cas d’échec partiel, arrêter : ne pas relancer à l’aveugle et ne pas utiliser `migrate resolve --applied` sans vérifier chaque effet.

## Sauvegarde créée ; restauration encore bloquante

La cible a été confirmée explicitement par le propriétaire. Il a ensuite autorisé une sauvegarde récente et une recette isolée, y compris leurs éventuels frais Railway, mais pas encore l’application des migrations en production.

L’API officielle Railway a permis de consulter les sauvegardes du volume-instance `9bab192c-8563-4bc3-b904-2e863d5ea89e`. Deux anciennes sauvegardes sont listées, avec dates d’expiration dépassées : `ac17bbdc-06a2-4eee-80d2-10b0a6048bcd` (23 août, expiration affichée au 22 septembre) et `a65615d7-bc11-4c4f-877f-8e4b09ab237a` (29 août, expiration affichée au 28 septembre). Aucun planning automatique. Leur restauration n’est pas validée.

La création d’un snapshot récent a été refusée explicitement par Railway : `Manual backups and backup schedules are only available for Pro workspaces`. Aucun changement d’abonnement effectué. Le format réel de l’API a été vérifié par introspection : la mutation renvoie désormais un objet `WorkflowId`, et non un scalaire comme dans l’exemple documentaire consulté. Aucune sauvegarde native n’a été créée.

Une alternative logique a réussi avec `pg_dump` 18.6 exécuté dans le conteneur Postgres :

- Fichier : `%LOCALAPPDATA%\Pencmi\backups\pencmi-20261028-185230.dump.dpapi`.
- Format : archive personnalisée PostgreSQL, chiffrée avec Windows DPAPI `CurrentUser` avant écriture sur disque.
- Taille de l’archive avant chiffrement : 130 650 octets.
- SHA-256 de l’archive : `D82EA3EA123018E5388710EAD5BA549BAE257802116B8DA74BBED4253417E36A`.
- En-tête `PGDMP`, déchiffrement et relecture du fichier chiffré vérifiés ; aucun fichier en clair ni secret enregistré dans Git.
- Les valeurs natives `PGDATABASE` et `PGUSER` utilisées par `pg_dump` correspondent à la base et à l’utilisateur de la connexion backend vérifiée.
- Cette protection dépend du compte Windows et de ses clés DPAPI. Le fichier seul n’est pas un export portable vers un autre ordinateur. Prévoir ensuite une copie hors machine avec un chiffrement et une gestion de clés adaptés.

La création de l’environnement vide `migration-check-20261028`, sans duplication de production et sans déploiement initial, a été refusée par Railway : `Deploys have been paused temporarily` (trace `7019832567731426552`). Une nouvelle lecture du projet confirme que seul `production` existe : aucun service de recette ni déploiement d’emails ou de jobs créé. La cause exacte de cette suspension n’a pas été établie ; ne pas l’attribuer arbitrairement à la facturation ou à un incident global.

Une tentative de lecture du catalogue de l’archive via `pg_restore --list` en SSH a été interrompue par une fermeture WebSocket distante. Elle ne constitue pas une validation du catalogue ni une restauration réussie. La sauvegarde est conservée, mais sa restaurabilité complète n’est pas encore démontrée. Ne pas lancer les migrations en production tant que ce point n’est pas levé.

Ouvrir le projet Railway pour comprendre et lever la suspension des déploiements ou contacter Railway avec la trace ci-dessus. Après résolution, créer uniquement une base de recette indépendante, sans backend ni jobs, puis restaurer cette archive et vérifier les données avant toute migration de production.

Avant toute migration :

1. Cible confirmée ; la reconfirmer si les services changent.
2. Conserver la sauvegarde logique créée. Si l’offre permet ultérieurement les snapshots, en créer également un récent ; ne pas restaurer les anciennes copies en production pour les tester.
3. Réactualiser l’export logique avant la fenêtre finale si des écritures ont eu lieu entre-temps. Utiliser un client PostgreSQL 18 compatible, des variables de connexion sécurisées et un support disposant de place. Conserver l’export chiffré hors du dépôt.
4. Vérifier l’archive puis la restaurer dans une base de recette isolée et vide, jamais dans la production. Vérifier les comptes de lignes et les contraintes. Une simple liste d’archive n’est pas une preuve de restauration.
5. Appliquer les migrations sur cette copie et exécuter les tests ci-dessous. Le provisionnement de cette base peut être payant : obtenir l’accord avant création.
6. Obtenir l’accord explicite pour la fenêtre d’intervention et le plan d’exécution en production.

Commandes à exécuter uniquement avec les variables de connexion correctement définies pour chaque cible :

```text
pg_dump --format=custom --no-owner --file=<chemin-securise>/pencmi-before-migrations.dump
pg_restore --list <chemin-securise>/pencmi-before-migrations.dump
pg_restore --no-owner --no-acl --exit-on-error --dbname=<base-recette-vide> <chemin-securise>/pencmi-before-migrations.dump
```

Ne pas mettre une URL contenant un mot de passe à la place du nom de base dans un terminal partagé. Ne pas restaurer la sauvegarde en production comme première réaction à un échec : cela pourrait écraser les écritures postérieures. Établir d’abord la cible et l’impact de la restauration.

## Plan de déploiement préparé, non activé

Après sauvegarde restaurée et validation explicite :

1. Suspendre temporairement les déploiements automatiques et planifier une fenêtre sans écritures applicatives ; traiter le déploiement actuellement en attente pour éviter une course de versions. Ne pas lancer plusieurs instances anciennes et nouvelles pendant l’opération.
2. Vérifier le commit prévu, la racine `/backend`, le `DATABASE_URL` privé référencé depuis Postgres et les migrations incluses dans l’image. Ne pas remplacer l’URL interne du backend par l’URL publique utilisée pour l’audit local.
3. Vérifier que `prisma` et les fichiers de migration sont présents dans l’image finale : Prisma est actuellement une dépendance de développement. Une image qui élague ces dépendances doit embarquer séparément le CLI de migration de la même version ; ne pas utiliser un téléchargement `npx` implicite au moment du déploiement.
4. Dans les paramètres de déploiement Railway du backend, prévoir comme **Pre-deploy Command** : `npm run prisma:deploy`. Cette commande existe déjà et applique les trois migrations dans leur ordre versionné. Ne pas l’insérer dans le démarrage de chaque replica.
5. Prévoir un délai maximal adapté à la taille des tables et un timeout de verrou étudié en recette. Ne pas imposer un timeout arbitrairement court susceptible de laisser un DDL partiellement exécuté.
6. Prévoir comme démarrage : `npm run start:prod`, et comme healthcheck : `/api/v1/health` si `API_PREFIX` reste `api/v1`. Ce healthcheck vérifie le processus, pas la compatibilité du schéma ; compléter avec l’audit et les tests fonctionnels.
7. En cas d’échec de la commande préalable, ne pas démarrer le nouveau backend. Examiner l’historique et les effets SQL en lecture seule avant toute reprise.
8. Après succès, relancer l’audit ci-dessous. Exiger les quatre migrations appliquées, checksums conformes, aucune anomalie et un diff vide. Démarrer ensuite une seule version du backend et réaliser les tests.
9. Réactiver les écritures et l’autodéploiement seulement après validation des contrôles. Les futures migrations devront aussi être revues : la commande préalable n’est pas une preuve de sauvegarde.

Railway exécute le pré-déploiement après la construction et avant le nouveau service, dans un conteneur séparé avec accès au réseau privé et aux variables. Un code de sortie non nul bloque le déploiement. Le conteneur préalable n’a pas les volumes montés : ne pas y déposer la sauvegarde. L’ancienne version peut encore servir des requêtes durant cette étape ; le pré-déploiement seul ne constitue pas une fenêtre de maintenance.

Références officielles : [pré-déploiement](https://docs.railway.com/deployments/pre-deploy-command), [sauvegardes et restauration](https://docs.railway.com/guides/postgres-backups-restores).

## Audit réexécutable

Depuis `backend`, après injection sécurisée du `DATABASE_URL` explicitement choisi :

```text
npm run prisma:audit
node --test scripts/audit-migrations.test.cjs
```

Le script ne charge pas implicitement un `.env` pour choisir sa cible. Il ne lance ni migration, ni réparation, ni écriture métier. Le catalogue est lu dans une transaction `READ ONLY` et la comparaison utilise `prisma migrate diff`. Les logs d’erreur restent génériques, sans détails de connexion ni logs SQL sensibles. Les migrations sont vérifiées par checksum en tolérant les fins de ligne Windows/Unix ; les effets partiels et les index invalides sont signalés.

Codes de sortie : `0` synchronisé ; `2` migrations en attente ou dérive ; `3` anomalie d’historique, effets non enregistrés ou comparaison non vérifiable ; `1` audit impossible. Toute dérive supplémentaire doit être examinée avant déploiement. Ne pas interpréter une erreur d’audit comme un schéma conforme.

## Vérifications fonctionnelles à faire après migration

| Contrôle | État pendant cet audit |
| --- | --- |
| Connexion utilisateur existant | Non exécutée : pas de session de recette autorisée, schéma incompatible |
| Refresh et rotation | Non exécutés en production avant migration |
| Rejeu du token | À faire sur une session de recette dédiée ; le test révoque cette session |
| Déconnexion | À faire sur la même session de recette |
| API partenaire | À faire avec une intégration et une clé de recette autorisées, sans afficher la clé |
| Avis annonceurs | Non validés tant que la table est absente |
| Création/reprise brouillon | À faire sur un compte de recette autorisé, pas sur une annonce existante |
| Lecture des annonces | `GET /api/v1/immobilier` : HTTP 200 ; lecture publique uniquement, pas validation complète du parcours |
| Santé API | `GET /api/v1/health` : HTTP 200 ; ne vérifie pas les tables attendues |

L’audit a confirmé l’historique et les absences directement sur la base vérifiée. Les 8 tests automatisés du nouvel outil sont réussis, dont la vérification des requêtes strictement en lecture seule et de l’absence de secrets dans les erreurs. Suite backend : 220 tests réussis, 2 tests PostgreSQL optionnels ignorés faute de base dédiée ; parcours navigateur immobilier inclus. Build NestJS réussi avec mémoire bornée et contrôle TypeScript. Ces tests ne remplacent pas les contrôles fonctionnels après une migration réelle.

Le script `scripts/backup-railway-postgres.ps1` a été exécuté avec succès pour l’export chiffré ci-dessus. Il requiert PowerShell 7 avec DPAPI Windows et un exécutable Railway authentifié explicitement indiqué. Il ne restaure ni n’applique aucune migration.

Aucun compte créé, aucune session révoquée, aucune clé générée, aucun avis ni brouillon inséré pendant ce diagnostic. Aucune des trois migrations en attente n’a été appliquée ou marquée comme appliquée.

## Fichiers livrés

- `backend/package.json` : commande `prisma:audit` uniquement, aucune dépendance ni commande de démarrage modifiée.
- `backend/scripts/audit-migrations.cjs` : historique, checksums, effets attendus et diff Prisma en lecture seule.
- `backend/scripts/audit-migrations.test.cjs` : 8 tests automatisés.
- `backend/scripts/backup-railway-postgres.ps1` : export logique, chiffrement DPAPI et vérification de relecture, sans restauration ni migration.
- `backend/docs/railway-migration-synchronization.md` : ce diagnostic et le plan conditionnel d’exécution.

Ni `schema.prisma`, ni les SQL versionnés, ni les données existantes, ni les variables du backend de production n’ont été modifiés.
