# Sessions et tokens JWT

## Contrôles à chaque accès

Le token d’accès est vérifié avec `JWT_SECRET`, l’algorithme HS256 et une
expiration obligatoire. `id` et `sessionId` doivent être des chaînes non
vides. La session et son compte sont ensuite chargés depuis la base : la
session doit exister, appartenir au compte et ne pas être révoquée ; le compte
doit exister, avoir le statut `active` et ne pas avoir de `deletedAt`.

Le rôle fourni aux guards de permissions vient exclusivement du compte
actuel en base. Un ancien rôle ou une liste de permissions dans le JWT ne
donne aucun privilège. Le type `AuthenticatedUser` exige maintenant un
`sessionId` pour les utilisateurs authentifiés.

## Renouvellement

La signature est vérifiée avec `REFRESH_TOKEN_SECRET`. Les identifiants et
l’expiration sont obligatoires. Le hash SHA-256 doit correspondre à un token
enregistré, non révoqué et non expiré. Son utilisateur et sa session doivent
correspondre aux identifiants signés ; la session et le compte sont contrôlés
selon les mêmes règles que pour l’accès.

La vérification et l’émission du nouveau refresh token utilisent une
transaction. Une mise à jour conditionnelle de la session impose à nouveau
le propriétaire, l’absence de révocation et un compte actif non supprimé.
Elle verrouille la même ligne que la déconnexion, afin qu’une déconnexion
concurrente ne laisse pas de nouveaux refresh tokens actifs après son commit.
L’expiration signée est revérifiée après l’acquisition du verrou.

Les durées de signature restent configurées par `JWT_EXPIRES_IN` et
`REFRESH_TOKEN_EXPIRES_IN`. `expiresAt` en base est calculé à partir de
l’expiration du JWT signé, et non d’une durée différente fixée à 30 jours.
Un identifiant aléatoire `jti` évite les collisions de hashes lorsque plusieurs
tokens sont créés pour la même session pendant une même seconde.

La politique de réutilisation existante des refresh tokens est conservée :
un renouvellement n’invalide pas automatiquement le token précédent. Tous
les refresh tokens de la session deviennent inutilisables à sa révocation.
La rotation à usage unique et la détection de réutilisation restent des
évolutions distinctes. Les secrets d’accès et de renouvellement doivent être
forts et distincts.

## Déconnexion

Le contrôleur fournit uniquement l’utilisateur et la session authentifiés.
Le service vérifie l’appartenance avant de révoquer la session et ses refresh
tokens dans une transaction. Aucun identifiant du corps HTTP ne choisit la
session à déconnecter. Une tentative d’atteindre la session d’un tiers est
refusée.

Le service est idempotent pour une session déjà révoquée appartenant au même
utilisateur. Un nouvel appel HTTP avec le token d’une session déjà révoquée
est refusé avec HTTP 401 par le guard, comme toute autre ressource protégée.
Les requêtes déjà autorisées et en cours d’exécution ne sont pas annulées ;
les contrôles s’appliquent aux validations suivantes.

## Compatibilité et vérifications

Les contrats HTTP de `login`, `register`, `refresh` et `logout` restent
inchangés. Le frontend stocke déjà les tokens retournés au renouvellement et
appelle la déconnexion sans identifiant de session. L’API partenaire hôtelière
continue d’utiliser son guard `X-API-Key`, sans modification.

Les anciens tokens restent acceptés uniquement s’ils comportent une
expiration et un `sessionId` valide associé au bon compte. Les tokens sans
session ou sans expiration imposent une nouvelle connexion. Les anciennes
dates d’expiration enregistrées ne sont pas réécrites : les deux expirations,
celle du JWT et celle de l’enregistrement, doivent encore être valides.

Les tests de sessions utilisent de vraies signatures JWT et les guards HTTP
réels, avec une base Prisma simulée. Les transactions et scénarios concurrents
ne constituent pas un test de concurrence sur PostgreSQL réel. Aucune
migration ni modification destructive de données n’est nécessaire. Aucun
token brut n’est journalisé par ces changements.
