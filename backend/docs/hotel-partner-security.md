# API partenaire hôtelière

Les routes partenaires conservent leur chemin `/api/hotel-partner/v1` et
restent exclues du préfixe utilisateur. Elles utilisent `X-API-Key`, jamais
un JWT utilisateur. Le marqueur `Public` désactive uniquement les guards
JWT et permissions utilisateur ; le guard `HotelPartnerGuard` est obligatoire
sur tout le contrôleur partenaire. Une opération sans permission déclarée
est refusée par défaut.

## Accès

- `GET /api/hotel-partner/v1/property/:externalPropertyId` nécessite
  `hotel.property.read`.
- `PUT /api/hotel-partner/v1/property/:externalPropertyId` nécessite
  `hotel.property.write`.
- `GET /api/hotel-partner/v1/events` exige une clé avec `hotel.requests.read`,
  puis répond HTTP 501 : aucun flux d’événements réel n’est implémenté.

Une clé d’écriture ne donne pas implicitement un droit de lecture. Les clés
existantes conservent leurs permissions ; aucun privilège n’est ajouté par
la migration. Les intégrations doivent avoir exactement le statut `active`.
Leur création et la création de clés ne les activent pas. Aucun nouveau
parcours d’activation ou de synchronisation n’est ajouté.

Une clé est refusée si elle est inconnue, révoquée (`revokedAt` renseigné),
désactivée (`active = false`), rattachée à une intégration inactive ou à un
établissement supprimé. Les journaux de refus ne contiennent ni clé, ni hash,
ni identifiant d’établissement. `lastUsedAt` est mis à jour après validation
de la clé et de son intégration, y compris si l’opération est ensuite refusée
pour une permission manquante.

Le mapping est recherché dans l’intégration authentifiée et doit pointer
vers son unique établissement. Un mapping absent ou incohérent produit
HTTP 404 sans révéler d’information sur un autre partenaire. Le PUT ne crée
pas d’établissement ou de mapping automatiquement.

## Données

Les seuls champs acceptés en écriture sont `name`, `propertyType`, `city` et
`region` (facultatif). Les autres champs sont refusés par la validation HTTP.
Le service utilise également une liste explicite de champs à écrire.
Les réponses établissement contiennent uniquement ces champs et
`externalPropertyId`, sans chambres, identifiant interne, propriétaire,
statut administratif ou coordonnées privées.

Les clés brutes sont affichées uniquement dans la réponse initiale à leur
création. Seul leur hash SHA-256 est stocké. Les réponses du dashboard et de
création ne retournent aucun `keyHash` ou `secretHash`. Les détails libres
des logs de synchronisation et des conflits ne sont plus exposés dans la
vue d’intégration afin d’éviter de divulguer des charges utiles sensibles.

## Déploiement et limites

Appliquer `npm run prisma:deploy` avant de démarrer cette version : la
migration `20261028000000_hotel_api_key_active` ajoute un booléen `active`
aux clés, sans supprimer de données. Exécuter `npm run prisma:generate`
avant la compilation. Aucune migration de production n’est exécutée par
les tests.

Les tests HTTP utilisent Nest, les guards réels, la validation et les chemins
versionnés, avec Prisma simulé. Ils ne constituent pas un test contre un
logiciel hôtelier externe ou une base PostgreSQL réelle.

Les autres routes documentées à l’avance (chambres, prix, disponibilités,
restrictions, messages, acquittement d’événements) ne sont pas implémentées
par cette correction. La livraison des webhooks reste incomplète : le hash
du secret existant ne suffit pas à signer des livraisons HMAC. Ne pas activer
ces fonctionnalités comme si elles étaient opérationnelles.
