# Moderation administrative des quatre univers

Base du lot : `097667bf766a9a3cd299b643189fe3f166122c8e`. Le correctif de secrets precedent n'est pas modifie.

## API et interface

Toutes les routes ci-dessous sont sous `/api/v1` et exigent un JWT de session valide et `access_admin`.

| Methode | Route | Usage |
| --- | --- | --- |
| GET | `/admin/validation` | File commune des quatre univers |
| GET | `/admin/listings/real-estate`, `/admin/listings/hotels`, `/admin/listings/vehicles` | Listes admin propres a chaque univers |
| GET | `/admin/validation/:module/:id` | Detail de moderation, sans contacts prives, document, configuration partenaire ou JSON brut |
| GET | `/admin/validation/:module/:id/photos/:photoId` | Apercu authentifie d'une photo geree liee a l'annonce |
| PATCH | `/admin/listings/{real-estate,hotels,vehicles,trips}/:id/status` | Decision de moderation |

`module` utilise `real_estate`, `hotels`, `vehicles`, `trips`. La file accepte `page`, `limit` (maximum 100), `module`, `status`, `search` (titre, ville ou ID), `advertiser` (nom ou raison sociale) et `ownerId` (exact). Les listes par univers n'acceptent qu'un filtre d'univers compatible. Le tri est `updatedAt DESC, module ASC, id ASC`, avec total filtre calcule sur le meme instantane PostgreSQL. Les suppressions logiques et le statut `deleted` sont exclus. L'ancienne liste admin immobilier renvoie maintenant l'enveloppe paginee habituelle `{ success, data, meta }`.

La page `/admin/validation` ouvre par defaut les annonces en attente. Les pages d'annonces par univers et la page globale utilisent la meme interface, avec filtres serveur, apercu accessible au clavier, confirmation et champ de motif. Le navigateur affiche le succes uniquement apres retour de l'API ; en cas de conflit il propose d'actualiser la file. Les totaux de navigation viennent des agregats `/admin/overview`, pas des lignes de la page en cours.

Les anciennes routes voyages restent disponibles. Le nouveau front lit leur projection de moderation dans la file commune, puis appelle le PATCH voyages existant. Les photos gerees JPEG, PNG et WebP passent par la lecture de fichiers existante, avec controle annonce/proprietaire/module et `private, no-store`. Les documents et URL externes historiques ne sont pas utilises comme apercus admin.

## Transitions, securite et traces

| Etat actuel | Decisions possibles |
| --- | --- |
| `pending_review` | `active`, `refused` |
| `active` | `suspended` |
| `suspended` | `active`, `refused` |
| `draft`, `refused`, `expired` | Aucune decision directe |
| Supprime ou absent | 404 |

Un refus ou une suspension exige un motif non blanc de 2 000 caracteres maximum. L'approbation et la reactivation permettent un motif facultatif. Le navigateur envoie `expectedUpdatedAt` pour ne pas prendre une decision sur une version devenue obsolete. Les champs inconnus sont refuses. Une decision repetee, une transition impossible ou une version obsolete repond 409. Les donnees de publication non conformes donnent 400, avec les erreurs de validation lorsque disponibles.

Le verrou PostgreSQL porte sur la ligne de l'annonce et reprend, pour l'hotel, l'ordre annonce puis integration. L'activation relit les donnees enregistrees et reutilise les validateurs de soumission. Aucun nouveau minimum de photos ou de stock n'est impose. Pour immobilier et voitures, les prix, la ville et la devise effectivement publies doivent correspondre aux valeurs valides. Pour les voyages, la materialisation existante des occurrences est conservee. La moderation ne modifie pas les tarifs, stocks, cles partenaires, allocations hotelieres ou demandes. Les proprietaires gardent leur parcours normal de correction et resoumission.

Le changement de statut, `AuditLog` (acteur, module, cible, ancien/nouveau statut, motif, date) et la notification au proprietaire sont dans une seule transaction. Une action refusant de changer l'etat n'ecrit aucun de ces effets. L'activation annonce la validation ou la reactivation ; le refus invite a corriger, la suspension indique la perte de visibilite. Le motif communique est affiche comme texte dans le centre `/dashboard/notifications`, relie au service de notifications existant. Aucun email ni traitement d'alerte de recherche n'est lance par ces decisions.

## Validation et limites

`admin-moderation-postgres.spec.ts` demarre les vrais modules NestJS, avec JWT et sessions authentiques, sur une base loopback suffixee `_test`. Il couvre la publication des quatre univers, les transitions publiques et favoris, la concurrence, les DTO et guards, la pagination, les donnees privees, les photos, les allocations et l'annulation transactionnelle sur erreur d'audit. Edge utilise ce meme backend via le serveur frontend de test : 360, 390, 768 et 1280 px, clavier, erreur reseau sans faux succes, compteurs et notifications annonceur.

- Backend : 584 tests reussis, dont les 9 nouveaux scenarios de moderation. Deux tests distants R2 restent ignores sans configuration de recette.
- Frontend : 53 tests reussis, un ancien scenario de recette distante voyages ignore. Le nouveau parcours navigateur voyages sur PostgreSQL local a ete execute.
- Outils : 21 tests reussis. TypeScript, ESLint, build et validation Prisma passent. Audit local en lecture seule : sept migrations, aucun ecart.

Le schema Prisma est inchange. Les annonces actives historiques ne sont pas remoderees en masse ; toute nouvelle approbation ou reactivation applique les validations. Les tests ne font aucune mutation en production. Le processeur `SAVED_ALERTS_PROCESSOR_ENABLED` n'est pas active dans ce lot. La sante Railway et les refus sans session se verifient separement d'un parcours authentifie de recette. Les neuf occurrences de l'alerte GitGuardian historique ne sont pas declarees closes par ce lot.
