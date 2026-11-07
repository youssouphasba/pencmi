# Revue de l'alerte Generic Password sur 331385a

## Perimetre et constat

Commit examine : `331385a4ebd41bdcd8282086dfe43b60d84701b6`.
Les 27 fichiers et les ajouts du commit ont ete examines. Aucune valeur suspecte n'est reproduite ici.

Dans les deux nouveaux tests `modules/users/account-profile.spec.ts` et
`modules/users/account-security-postgres.spec.ts`, les valeurs conformes a la
politique de mot de passe etaient composees d'un fragment fixe et d'un UUID
aleatoire. Le fragment seul n'etait pas un identifiant utilisable. Les autres
valeurs litterales servaient aux cas volontairement invalides.

La suite PostgreSQL genere des identifiants ephemeres, refuse une cible autre
qu'une base loopback dont le nom se termine par `_test`, cree ses propres
comptes de test et les nettoie. Elle ne reutilise pas des comptes Railway.

Les fichiers `auth/registration-security.spec.ts` et `auth/session-security.spec.ts`,
deja existants et ajustes dans le commit, contenaient egalement des mots de
passe et cles de signature statiques pour leurs doubles Prisma/JWT. Leur
stockage est simule en memoire, sans serveur ni service de production.

Une comparaison locale, en lecture seule, des lignes ajoutees au commit avec
les variables sensibles du backend Railway de production a controle huit
valeurs candidates, y compris les mots de passe extraits des URL lorsqu'ils
etaient presents. Aucune correspondance n'a ete trouvee. Aucune valeur de
configuration n'a ete affichee, modifiee ni inscrite dans le depot.

Ces constats sur les ajouts de 331385a identifient des donnees de tests, pas
un secret de service reel. Ils ne remplacent pas le rapprochement avec l'incident GitGuardian : ses neuf
emplacements exacts n'ont pas ete fournis et aucun rapport detaille n'etait
accessible dans les checks GitHub publics du commit. L'incident externe n'est
donc pas declare clos.

## Exposition reelle distincte, confirmee pendant l'audit elargi

Deux anciens scripts, `scripts/seed-public-showcase.cjs` et
`scripts/seed-real-estate-demo.cjs`, contenaient sept couples d'identifiants
statiques et pouvaient afficher les mots de passe dans leurs sorties.
Ils n'ont pas ete ajoutes par 331385a, mais ne devaient pas rester en place.

Une verification PostgreSQL strictement en lecture seule depuis le service
Railway a compare les mots de passe aux hashes bcrypt des comptes cibles,
sans exposer valeurs ni hashes. Cinq comptes de demonstration actifs
correspondaient encore aux identifiants du script de vitrine : agence,
hotel, vehicules, transport et client. Il s'agissait donc de vrais acces,
meme si leur origine etait demonstrative.

Apres autorisation explicite de l'utilisateur, le 7 novembre 2026 :

- Rotation transactionnelle des cinq mots de passe, avec valeurs cryptographiques generees sur le serveur et hashes bcrypt cout 12.
- Revocation de 14 sessions et 14 refresh tokens ; audit `security.seed_credentials_rotated` sans secret.
- Verification ulterieure : cinq comptes controles, aucune correspondance avec les anciens mots de passe, aucune session ni refresh token actif.
- Aucun compte admin modifie, aucune suppression de compte, d'annonce ou de demande ; aucune reecriture Git.

Les nouvelles valeurs n'ont pas ete affichees ni conservees. Un prochain
acces aux comptes de demonstration necessite une reinitialisation par un
outil interne autorise ; ne pas relancer un seed pour recuperer un acces,
car les seeds ont des effets sur les donnees.

Le code n'impose plus de mot de passe par defaut : les scripts exigent des
variables distinctes `PENCMI_SHOWCASE_<AGENCY|HOTEL|VEHICLE|TRIP|CLIENT>_PASSWORD`
ou `PENCMI_DEMO_AGENCY_PASSWORD` / `PENCMI_DEMO_CLIENT_PASSWORD`, validees avant
toute mutation ou nettoyage. Les sorties et erreurs ne publient pas les
credentials. Les arguments CLI contenant un mot de passe ne sont plus acceptes.

## Correction

- Generation cryptographique des mots de passe et cles de tests via un helper commun, sans fragment de mot de passe constant.
- Cas invalides toujours couverts : mauvaise valeur, mot de passe faible, longueur UTF-8 excessive et mauvaise signature JWT, mais avec des donnees generees a l'execution.
- Tests de non-regression sur unicite, complexite, limite bcrypt en octets et absence de litteraux fixes affectes aux champs d'identification dans les sept suites concernees.
- Aucune modification de configuration de production ni du backend metier. Les seules mutations de production sont la rotation explicitement autorisee ci-dessus et ses revocations/audits. Aucun reset de base ni aucune reecriture de l'historique Git.

## Verification et cloture

Sur PostgreSQL local isole, 575 tests backend ont reussi, y compris les
tests HTTP et navigateur. Deux tests R2 conditionnels ont ete ignores.
Les quatre tests des scripts ont reussi, dont le refus avant acces a la
base lorsqu'un mot de passe manque. Le controle des fichiers suivis ne
retrouve plus les anciennes valeurs de test ou de demonstration comparees.
Le controle AST ajoute n'est pas un scanner universel de secrets et ne
remplace pas GitGuardian. L'eventuelle utilisation anterieure par des tiers
n'a pas ete determinee par cette verification.

Pour clore formellement l'incident, rapprocher les neuf chemins et lignes du
rapport GitGuardian avec les fixtures examinees, puis relancer le controle
GitGuardian sur le correctif. Le commit historique reste present : si les neuf
occurrences correspondent aux fixtures decrites, leur classement approprie
est faux positif/donnee de test, avec ces preuves, et non secret revoque.

Si un autre emplacement correspond a une valeur reelle, le traiter comme
compromis : identifier son fournisseur, revoquer ou remplacer la valeur cote
service, mettre a jour les variables consommatrices, verifier le fonctionnement
avec la nouvelle valeur et confirmer le refus de l'ancienne. Pour un mot de
passe de compte, changer le mot de passe et revoquer ses sessions ; pour une
cle JWT, planifier la rotation et l'invalidation des sessions concernees.
Ne pas publier les valeurs ni reecrire l'historique sans autorisation.
