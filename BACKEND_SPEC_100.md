# Cahier des charges backend Péncmi

Ce document fixe la cible backend complète de Péncmi. Il doit servir de référence avant toute implémentation.

## 1. Objectif

Construire un backend professionnel, sécurisé, modulaire et évolutif pour alimenter le frontend Péncmi existant :

- Immobilier ;
- Hôtels, auberges, résidences et appartements meublés ;
- Voitures : vente, location, chauffeur, garage ;
- Voyages interurbains : bus, cars, minibus, 7 places, covoiturage organisé ;
- espaces clients ;
- dashboards annonceurs ;
- back-office admin ;
- contenus administrables ;
- SEO, GEO, notifications, emails, tracking, statistiques, vérification, modération et monétisation future.

Le backend doit être pensé pour durer. Il ne doit pas être une maquette jetable.

## 2. Stack technique

- API : Node.js avec NestJS.
- Base de données : PostgreSQL.
- ORM : Prisma.
- Hébergement : Railway.
- Authentification : JWT, refresh tokens, sessions révocables.
- Fichiers : abstraction compatible S3 et Cloudflare R2.
- Jobs : worker séparé pour emails, notifications, webhooks, synchronisations et traitements longs.
- Queue : BullMQ avec Redis.
- Emails : architecture compatible Resend.
- Validation : DTO stricts.
- Documentation : Swagger / OpenAPI.
- Tests : unitaires et intégration API.
- Logs : serveur, API, sécurité, admin, workers, webhooks et synchronisation.

## 3. Architecture cible

```txt
src/
  common/
    decorators/
    guards/
    filters/
    interceptors/
    errors/
    pagination/
    responses/
    validation/
    utils/
  config/
  database/
    prisma/
  auth/
  jobs/
  files/
  audit/
  modules/
    users/
    professional-profiles/
    permissions/
    locations/
    content/
    hotels/
    hotel-integrations/
    real-estate/
    vehicles/
    trips/
    conversations/
    messages/
    contacts/
    notifications/
    emails/
    reports/
    moderation/
    verification/
    support/
    tracking/
    statistics/
    seo/
    geo/
    billing/
    admin/
```

Centraliser :

- rôles ;
- permissions ;
- statuts ;
- modules Péncmi ;
- routes API ;
- erreurs API ;
- formats de réponse ;
- pagination ;
- filtres ;
- événements tracking ;
- actions auditables ;
- règles d’accès ;
- règles de visibilité publique ;
- constantes SEO et GEO ;
- statuts métier communs.

## 4. Versionnement API

Toutes les routes applicatives doivent être versionnées :

```txt
/api/v1/...
/api/hotel-partner/v1/...
```

Aucune route métier durable ne doit être créée hors versionnement, sauf fichiers publics comme :

```txt
/robots.txt
/sitemap.xml
/llms.txt
/ai.txt
/about-pencmi.txt
```

## 5. Réponse API standard

Succès :

```ts
{
  success: true,
  data: unknown,
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    requestId?: string;
  }
}
```

Erreur :

```ts
{
  success: false,
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  }
}
```

Toutes les routes doivent respecter ce format, sauf fichiers publics, webhooks ou endpoints techniques ayant une raison documentée.

## 6. Phasage obligatoire

Le backend ne doit pas être livré en un seul bloc non vérifiable.

### Phase 1 : fondations

- NestJS ;
- Prisma ;
- PostgreSQL ;
- configuration `.env` validée ;
- réponse API standard ;
- erreurs globales ;
- pagination ;
- Swagger ;
- healthcheck ;
- logs structurés ;
- audit base ;
- Docker local si utile ;
- scripts Railway.

### Phase 2 : auth, utilisateurs, rôles, permissions

- inscription ;
- connexion ;
- déconnexion ;
- refresh token ;
- sessions ;
- révocation ;
- mot de passe oublié ;
- reset password ;
- profil utilisateur ;
- profils professionnels ;
- guards ;
- ownership checks ;
- brute force protection.

### Phase 3 : modules transversaux

- fichiers ;
- contenus administrables ;
- conversations ;
- messages ;
- contacts ;
- notifications ;
- emails ;
- support ;
- audit logs.

### Phase 4 : hôtels et intégration logicielle hôtel

- hôtels ;
- chambres ;
- prix ;
- disponibilités ;
- demandes de réservation ;
- intégration directe logiciel hôtelier ;
- API partenaire ;
- webhooks ;
- conflits ;
- logs de synchronisation.

### Phase 5 : immobilier, voitures, voyages

- annonces ;
- recherche ;
- filtres ;
- demandes ;
- favoris ;
- messages ;
- contacts ;
- signalements ;
- validation admin.

### Phase 6 : admin, modération, vérification

- utilisateurs ;
- annonceurs ;
- annonces ;
- validation ;
- signalements ;
- modération ;
- vérification ;
- décisions admin ;
- audit.

### Phase 7 : SEO, GEO, tracking, statistiques, monétisation

- métadonnées ;
- sitemaps ;
- fichiers IA ;
- événements ;
- KPI ;
- plans ;
- boosts ;
- sponsorisations ;
- facturation future.

### Phase 8 : durcissement production

- tests complets ;
- sécurité ;
- performance ;
- rate limiting ;
- monitoring ;
- sauvegarde ;
- déploiement Railway ;
- documentation finale.

## 7. Authentification et rôles

Rôles :

```ts
type UserRole =
  | "client"
  | "advertiser_individual"
  | "real_estate_agency"
  | "hotel_manager"
  | "vehicle_renter"
  | "vehicle_dealer"
  | "chauffeur"
  | "transport_provider"
  | "admin";
```

À créer :

- `hasPermission`;
- `canAccessModule`;
- `canManageResource`;
- auth guard ;
- admin guard ;
- advertiser guard ;
- ownership guard ;
- module guard ;
- permission guard.

Règle stricte : un utilisateur ne peut accéder qu’à ses propres données, sauf permission admin explicite.

## 8. Multi-tenant et ownership

Règles obligatoires :

- un annonceur ne lit jamais les données d’un autre annonceur ;
- un hôtel ne lit jamais les chambres, prix, disponibilités, clés API ou webhooks d’un autre hôtel ;
- une clé API hôtel est liée à un hôtel ou groupe d’établissements autorisé ;
- un client ne lit que ses favoris, demandes, messages, notifications et signalements ;
- l’admin peut traverser les tenants seulement via routes admin auditées ;
- chaque requête sensible doit vérifier l’owner côté backend, pas seulement côté frontend.

## 9. Idempotence

Prévoir une `idempotencyKey` pour les actions sensibles :

- demande de réservation ;
- demande de visite ;
- demande de place ;
- demande location ;
- demande chauffeur ;
- création contact ;
- envoi message ;
- favoris ;
- webhooks ;
- API partenaire hôtel ;
- emails ;
- paiements futurs ;
- actions admin critiques.

Une même clé rejouée doit retourner le même résultat ou refuser proprement le doublon.

## 10. Modèle PostgreSQL / Prisma

Le schéma Prisma doit prévoir :

- relations propres ;
- clés étrangères ;
- enums ;
- contraintes d’unicité ;
- index ;
- soft delete quand nécessaire ;
- timestamps ;
- audit logs ;
- transactions Prisma pour actions critiques.

Actions transactionnelles obligatoires :

- créer une demande ;
- créer un contact event ;
- créer une notification ;
- préparer un email ;
- préparer un webhook ;
- écrire un audit log ;
- modifier un statut admin sensible.

## 11. Tables principales

### Auth / utilisateurs

- users
- user_sessions
- refresh_tokens
- password_reset_tokens
- professional_profiles
- audit_logs

### Localisation Sénégal

- regions
- departments
- cities
- districts
- stations
- popular_locations
- location_aliases
- geo_slugs

### Fichiers

- files
- file_usages

### Hôtels

- hotel_properties
- hotel_rooms
- hotel_room_rates
- hotel_room_availability
- hotel_restrictions
- hotel_reservation_requests

### Intégration logiciel hôtelier

- hotel_integrations
- hotel_api_keys
- hotel_webhooks
- hotel_webhook_deliveries
- hotel_sync_logs
- hotel_sync_conflicts
- hotel_external_mappings
- hotel_field_mappings

### Immobilier

- real_estate_listings
- real_estate_visit_requests

### Voitures

- vehicle_listings
- vehicle_availability
- vehicle_rental_requests
- vehicle_chauffeur_requests

### Voyages

- trip_listings
- trip_seat_requests

### Conversations / messages / contacts

- conversations
- conversation_participants
- messages
- contact_events

### Notifications / emails

- notifications
- email_templates
- email_logs

### Favoris / alertes

- favorites
- saved_alerts

### Signalements / modération

- reports
- moderation_decisions

### Vérification

- verification_requests
- verification_documents

### Support

- support_tickets
- support_messages
- support_categories

### Contenus administrables

- content_pages
- content_sections
- content_versions
- faq_items
- safety_tips
- publishing_rules
- anti_scam_tips
- report_reasons
- footer_links

### Tracking / statistiques

- tracking_events

### SEO / GEO

- seo_metas
- seo_templates
- seo_slugs
- seo_redirects
- seo_locations
- geo_entities
- geo_questions
- geo_templates
- geo_guides
- geo_public_files

### Monétisation

- billing_plans
- advertiser_subscriptions
- listing_boosts
- sponsored_listings
- billing_invoices
- payment_methods
- promotions
- pricing_rules

## 12. Index et contraintes

Exemples obligatoires :

- email unique ;
- phone unique si renseigné ;
- slug unique par module ;
- `roomId + date` unique pour disponibilité ;
- `roomId + date + ratePlan` unique pour prix ;
- externalPropertyId unique par intégration hôtel ;
- externalRoomId unique par propriété hôtel ;
- api key hash unique ;
- webhook event id unique ;
- conversation index par participant ;
- message index par conversation + date ;
- notification index par user + statut ;
- contact event index par module + target + date ;
- tracking event index par module + target + date ;
- audit log index par actor + date ;
- SEO path unique ;
- slug SEO unique ;
- idempotency key unique par scope.

## 13. Soft delete

Soft delete par défaut pour :

- utilisateurs ;
- annonces ;
- hôtels ;
- chambres ;
- voitures ;
- trajets ;
- messages ;
- fichiers ;
- contenus ;
- signalements ;
- demandes ;
- support tickets.

Hard delete uniquement pour :

- tokens expirés ;
- sessions expirées ;
- jobs temporaires ;
- caches ;
- données à supprimer dans un processus légal/RGPD documenté.

Les audit logs ne doivent pas être supprimés dans le flux normal.

## 14. Contenus administrables

Ne pas coder en dur les contenus évolutifs :

- pages légales ;
- FAQ ;
- aide ;
- conseils sécurité ;
- conseils anti-arnaque ;
- règles de publication ;
- catégories support ;
- liens footer ;
- motifs de signalement ;
- templates emails ;
- textes longs ;
- blocs SEO ;
- blocs GEO ;
- contenus marketing longs.

Le code peut contenir :

- routes ;
- clés ;
- enums ;
- statuts internes ;
- permissions ;
- fallbacks courts.

## 15. Modules métier

Chaque module public doit avoir :

- API lecture publique ;
- API dashboard annonceur ;
- API admin ;
- filtres ;
- recherche ;
- pagination ;
- statuts ;
- favoris ;
- contacts ;
- messages ;
- signalements ;
- validation admin ;
- tracking ;
- statistiques ;
- ownership checks.

## 16. Hôtels

APIs publiques :

```txt
GET /api/v1/hotels
GET /api/v1/hotels/:id
GET /api/v1/hotels/:id/rooms
GET /api/v1/hotels/:id/availability
POST /api/v1/hotels/:id/reservation-requests
POST /api/v1/hotels/:id/contact
```

APIs dashboard :

```txt
GET /api/v1/dashboard/hotels
POST /api/v1/dashboard/hotels
GET /api/v1/dashboard/hotels/:id
PUT /api/v1/dashboard/hotels/:id
DELETE /api/v1/dashboard/hotels/:id
POST /api/v1/dashboard/hotels/:id/rooms
PUT /api/v1/dashboard/hotels/:id/rooms/:roomId
DELETE /api/v1/dashboard/hotels/:id/rooms/:roomId
GET /api/v1/dashboard/hotels/reservations
PATCH /api/v1/dashboard/hotels/reservations/:id/status
GET /api/v1/dashboard/hotels/statistics
```

Le modèle par défaut est une demande de réservation confirmée ensuite par l’établissement.

## 17. Intégration logiciel hôtelier

Le logiciel interne hôtelier est la source de vérité principale pour :

- prix ;
- disponibilités ;
- restrictions ;
- stock de chambres ;
- statuts de chambres ;
- fermetures ;
- stop sell.

En cas de conflit, le logiciel interne gagne par défaut.

Si la synchronisation est ancienne, échouée ou non fiable, Péncmi affiche :

```txt
Disponibilité à confirmer
```

Ne jamais afficher une disponibilité comme certaine si la donnée n’est pas fiable.

Endpoints partenaires :

```txt
PUT /api/hotel-partner/v1/property/:externalPropertyId
GET /api/hotel-partner/v1/property/:externalPropertyId
PUT /api/hotel-partner/v1/property/:externalPropertyId/rooms/:externalRoomId
GET /api/hotel-partner/v1/property/:externalPropertyId/rooms
PATCH /api/hotel-partner/v1/property/:externalPropertyId/rooms/:externalRoomId/status
POST /api/hotel-partner/v1/rates
POST /api/hotel-partner/v1/rates/bulk
POST /api/hotel-partner/v1/availability
POST /api/hotel-partner/v1/availability/bulk
POST /api/hotel-partner/v1/restrictions
POST /api/hotel-partner/v1/restrictions/bulk
GET /api/hotel-partner/v1/reservation-requests
PATCH /api/hotel-partner/v1/reservation-requests/:requestId/status
GET /api/hotel-partner/v1/messages
POST /api/hotel-partner/v1/messages/:conversationId/reply
GET /api/hotel-partner/v1/events
POST /api/hotel-partner/v1/events/:eventId/acknowledge
```

Clés API hôtel :

- clé complète visible une seule fois ;
- clé stockée hashée ;
- clé masquée ensuite ;
- permissions strictes ;
- révocation ;
- rotation ;
- logs d’usage ;
- rate limiting ;
- audit.

Webhooks hôtels sortants :

- signature HMAC ;
- retry automatique ;
- logs de livraison ;
- statut pending, sent, failed, retrying ;
- envoi via worker ;
- idempotence ;
- contrôleurs non bloquants.

## 18. Immobilier

APIs publiques :

```txt
GET /api/v1/immobilier
GET /api/v1/immobilier/:id
POST /api/v1/immobilier/:id/visit-requests
POST /api/v1/immobilier/:id/contact
```

APIs dashboard :

```txt
GET /api/v1/dashboard/immobilier
POST /api/v1/dashboard/immobilier
GET /api/v1/dashboard/immobilier/:id
PUT /api/v1/dashboard/immobilier/:id
DELETE /api/v1/dashboard/immobilier/:id
GET /api/v1/dashboard/immobilier/statistics
```

## 19. Voitures

APIs publiques :

```txt
GET /api/v1/voitures
GET /api/v1/voitures/:id
POST /api/v1/voitures/:id/rental-requests
POST /api/v1/voitures/:id/chauffeur-requests
POST /api/v1/voitures/:id/contact
```

APIs dashboard :

```txt
GET /api/v1/dashboard/voitures
POST /api/v1/dashboard/voitures
GET /api/v1/dashboard/voitures/:id
PUT /api/v1/dashboard/voitures/:id
DELETE /api/v1/dashboard/voitures/:id
GET /api/v1/dashboard/voitures/statistics
```

## 20. Voyages

APIs publiques :

```txt
GET /api/v1/voyages
GET /api/v1/voyages/:id
POST /api/v1/voyages/:id/seat-requests
POST /api/v1/voyages/:id/contact
```

APIs dashboard :

```txt
GET /api/v1/dashboard/voyages
POST /api/v1/dashboard/voyages
GET /api/v1/dashboard/voyages/:id
PUT /api/v1/dashboard/voyages/:id
DELETE /api/v1/dashboard/voyages/:id
GET /api/v1/dashboard/voyages/statistics
```

## 21. Conversations, messages, contacts

APIs :

```txt
GET /api/v1/messages/conversations
GET /api/v1/messages/conversations/:id
POST /api/v1/messages/conversations/:id/messages
PATCH /api/v1/messages/conversations/:id/read
```

Chaque interaction importante doit produire un contact event ou tracking event exploitable.

## 22. Notifications

APIs :

```txt
GET /api/v1/notifications
PATCH /api/v1/notifications/:id/read
PATCH /api/v1/notifications/read-all
```

Notifications :

- nouveau message ;
- nouvelle demande ;
- changement de statut ;
- validation admin ;
- refus admin ;
- signalement ;
- vérification ;
- webhook échoué ;
- synchronisation en erreur ;
- support.

## 23. Emails

Tous les emails passent par le worker.

Fonctions :

- templates administrables ;
- variables dynamiques ;
- queue ;
- logs ;
- retries ;
- statut pending, sent, failed, cancelled.

Ne pas envoyer d’email directement depuis un contrôleur.

## 24. Fichiers

APIs :

```txt
POST /api/v1/files/upload
GET /api/v1/files/:id
DELETE /api/v1/files/:id
```

À prévoir :

- validation MIME ;
- validation taille ;
- metadata ;
- owner ;
- usage public/privé ;
- association module ;
- suppression logique ;
- abstraction local/S3/R2.

## 25. Admin

Toutes les actions sensibles doivent écrire dans `audit_logs`.

Actions sensibles :

- valider annonce ;
- refuser annonce ;
- suspendre annonce ;
- réactiver annonce ;
- supprimer contenu ;
- modifier contenu légal ;
- suspendre utilisateur ;
- révoquer clé API ;
- modifier permissions ;
- valider vérification ;
- refuser vérification ;
- changer pricing ;
- déclencher une action de modération.

## 26. Signalements et modération

APIs :

```txt
POST /api/v1/reports
GET /api/v1/compte/signalements
GET /api/v1/dashboard/reports
GET /api/v1/admin/reports
PATCH /api/v1/admin/reports/:id/status
POST /api/v1/admin/reports/:id/decision
```

## 27. Tracking et statistiques

Événements :

- vue annonce ;
- clic détail ;
- clic WhatsApp ;
- clic téléphone ;
- clic email ;
- formulaire envoyé ;
- favori ajouté ;
- demande envoyée ;
- message envoyé ;
- visite demandée ;
- réservation demandée ;
- demande location ;
- demande chauffeur ;
- demande de place.

Règle : aucun KPI inventé. Tous les KPI viennent d’événements réellement enregistrés.

## 28. SEO

APIs :

```txt
GET /api/v1/seo/meta?path=
GET /sitemap.xml
GET /robots.txt
GET /sitemaps/:name.xml
```

Les pages privées sont toujours `noindex` :

- admin ;
- dashboard ;
- compte ;
- login ;
- register ;
- messages ;
- notifications ;
- paramètres ;
- support privé.

## 29. GEO

Routes publiques :

```txt
GET /llms.txt
GET /ai.txt
GET /about-pencmi.txt
GET /data/platform-summary.json
GET /data/public-entities.json
GET /data/public-routes.json
```

Ne jamais exposer de données privées dans les fichiers IA.

## 30. Monétisation

Préparer :

- plans ;
- abonnements ;
- boosts ;
- sponsorisations ;
- factures ;
- promotions ;
- pricing ;
- moyens de paiement ;
- historique ;
- statuts paiement.

Providers futurs :

- Stripe ;
- Wave ;
- Orange Money ;
- Free Money ;
- PayDunya ;
- CinetPay ;
- Flutterwave ;
- virement manuel.

Ne pas confondre :

- vérifié ;
- professionnel ;
- premium ;
- sponsorisé.

## 31. Support

APIs :

```txt
POST /api/v1/support/tickets
GET /api/v1/support/tickets
GET /api/v1/support/tickets/:id
POST /api/v1/support/tickets/:id/messages
GET /api/v1/admin/support/tickets
PATCH /api/v1/admin/support/tickets/:id
```

## 32. Jobs et workers

Le worker traite :

- emails ;
- notifications différées ;
- webhooks hôtels ;
- retries ;
- synchronisations ;
- génération sitemap ;
- génération fichiers GEO ;
- nettoyage logs ;
- imports ;
- traitements lourds ;
- relances.

Les contrôleurs API ne doivent pas exécuter les tâches longues.

## 33. Sécurité obligatoire

- validation stricte ;
- CORS propre ;
- rate limiting ;
- brute force login protection ;
- hash mot de passe ;
- JWT expirables ;
- refresh tokens sécurisés ;
- sessions révocables ;
- permissions backend ;
- ownership checks ;
- protection IDOR ;
- transactions ;
- audit logs ;
- sanitation HTML ;
- contrôle uploads ;
- API keys hashées ;
- webhooks signés ;
- idempotence ;
- séparation client/annonceur/admin ;
- aucun accès cross-tenant ;
- logs actions sensibles.

## 34. RGPD et données personnelles

Prévoir :

- export données utilisateur ;
- anonymisation ;
- suppression logique ;
- consentements ;
- données sensibles ;
- durée de conservation ;
- traçabilité admin ;
- suppression définitive uniquement via processus documenté.

## 35. Observabilité

Prévoir :

- logs structurés JSON ;
- request id ;
- correlation id ;
- logs worker ;
- logs webhook ;
- logs sécurité ;
- logs admin ;
- healthcheck ;
- readiness check ;
- error tracking futur ;
- métriques basiques.

## 36. Variables d’environnement

À documenter :

```txt
DATABASE_URL
JWT_SECRET
JWT_EXPIRES_IN
REFRESH_TOKEN_SECRET
REFRESH_TOKEN_EXPIRES_IN
FRONTEND_URL
BACKEND_URL
CORS_ORIGINS
REDIS_URL
RESEND_API_KEY
EMAIL_FROM
STORAGE_DRIVER
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
R2_ACCOUNT_ID
RATE_LIMIT_TTL
RATE_LIMIT_MAX
RAILWAY_ENVIRONMENT
```

## 37. Seeds

Autorisé :

- admin minimal ;
- rôles ;
- permissions ;
- statuts techniques ;
- régions/villes/gares de référence si validées.

Interdit :

- fausses annonces ;
- faux utilisateurs publics ;
- faux KPI ;
- faux messages ;
- fausses réservations.

## 38. Tests obligatoires

Chaque module doit avoir :

- tests service ;
- tests controller/API ;
- tests permissions ;
- tests ownership ;
- tests cas vide ;
- tests erreurs.

Tests bloquants :

- auth ;
- refresh token ;
- sessions ;
- rôles ;
- permissions ;
- ownership ;
- CRUD hôtels ;
- chambres ;
- prix ;
- disponibilités ;
- demandes réservation ;
- intégration hôtel ;
- API keys hôtel ;
- webhooks signés ;
- immobilier ;
- voitures ;
- voyages ;
- messages ;
- contacts ;
- notifications ;
- fichiers ;
- admin validation ;
- signalements ;
- vérification ;
- contenus administrables ;
- SEO/noindex ;
- idempotence ;
- transactions critiques.

## 39. Swagger / OpenAPI

Swagger doit inclure :

- tags par module ;
- DTO ;
- schémas de réponse standard ;
- erreurs ;
- auth Bearer ;
- exemples ;
- pagination ;
- filtres ;
- endpoints partner hotel ;
- endpoints admin.

## 40. Déploiement Railway

Prévoir :

- guide local ;
- guide production ;
- migrations Prisma ;
- rollback ;
- healthcheck ;
- readiness check ;
- worker séparé ;
- Redis ;
- variables d’environnement ;
- logs ;
- scripts de build ;
- scripts de migration ;
- seed admin minimal.

## 41. Règle qualité finale

Aucune route backend ne doit être créée sans :

- modèle de données clair ;
- DTO de validation ;
- permissions ;
- ownership check ;
- réponse API standard ;
- gestion d’erreur ;
- pagination si liste ;
- transaction si action critique ;
- audit si action sensible ;
- index si recherche fréquente ;
- idempotence si action sensible ;
- test minimal ;
- documentation Swagger.

## 42. Informations à fournir avant implémentation

Voir la liste demandée dans la réponse de fin de tâche.
