# Vérification des professionnels

Un professionnel envoie ses justificatifs ; un admin les examine et décide. Une validation affiche le badge « Professionnel vérifié » (`User.professionalVerified` et `ProfessionalProfile.verified`) sur ses annonces et son profil public.

## Documents demandés

| Compte | Obligatoires |
| --- | --- |
| Particulier annonceur | Pièce d'identité |
| Agence immobilière, hôtel, loueur, vendeur de voitures | Pièce d'identité, registre de commerce (RCCM) |
| Chauffeur | Pièce d'identité, permis de conduire |
| Transporteur | Pièce d'identité, RCCM, autorisation de transport |

Documents facultatifs : NINEA, carte professionnelle, justificatif d'adresse, autorisation d'exploitation hôtelière, carte grise, assurance, autre. Six fichiers au maximum, 5 Mo chacun, PDF, JPEG, PNG ou WebP. Les images sont réencodées, ce qui supprime leurs métadonnées (position GPS comprise) ; un PDF doit commencer par `%PDF-` et se terminer par `%%EOF`. Les comptes clients et admin ne sont pas concernés.

## API

Professionnel (authentifié) :
- `GET /api/v1/verification/me` : badge, documents demandés, dernière demande et motif éventuel.
- `POST /api/v1/verification/requests` : multipart, un fichier par champ, le nom du champ étant le type de document. Refusé si une demande est déjà en cours, si le profil est déjà vérifié ou si un document obligatoire manque. Limité à 5 envois par heure.

Admin (`access_admin`) :
- `GET /api/v1/admin/verification/requests?status=pending&page=1` : file d'attente, les plus anciennes d'abord.
- `GET /api/v1/admin/verification/requests/:id` : compte, profil et documents.
- `GET /api/v1/admin/verification/requests/:id/documents/:documentId` : téléchargement (`Content-Disposition: attachment`, CSP `sandbox`), journalisé dans `AuditLog` (`verification.document_viewed`).
- `PATCH /api/v1/admin/verification/requests/:id` `{ decision: accepted | refused | requires_more_info, reason }` : motif obligatoire sauf validation. Une seule décision par demande (mise à jour conditionnelle).
- `POST /api/v1/admin/verification/users/:userId/revoke` `{ reason }` : retire le badge.

Chaque décision crée une notification interne, un email métier si `BUSINESS_EMAILS_ENABLED=true`, et une entrée `AuditLog`.

## Conservation

Les fichiers sont stockés en privé (`verification/<userId>/<requestId>/…` sur R2 ou le disque local), lisibles seulement par leur propriétaire et, via l'API admin, par un administrateur. Ils sont supprimés dès la décision prise, quelle qu'elle soit ; la demande garde le type des documents, le statut, le motif, l'admin et la date. Après une demande de correction, le professionnel renvoie l'ensemble des documents.
