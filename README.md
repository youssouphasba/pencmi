# Péncmi

Péncmi est une plateforme frontend multi-services pour le Sénégal, structurée autour de quatre univers :

- Immobilier
- Hôtels, auberges, résidences et appartements meublés
- Voitures
- Voyages interurbains

Le projet actuel contient l’interface frontend, les routes publiques, les espaces clients, les dashboards annonceurs, l’administration, les pages SEO/GEO et les structures transversales.

## État actuel

- Frontend statique structuré par modules.
- Données réelles, authentification, paiements, notifications et emails non connectés.
- États vides prévus pour éviter les fausses données.
- Contenus éditoriaux préparés pour devenir administrables.
- Spécification backend complète disponible dans `BACKEND_SPEC_100.md`.

## Backend

Le backend cible est decrit dans `BACKEND_SPEC_100.md` :

- NestJS
- PostgreSQL
- Prisma
- Railway
- JWT, refresh tokens et sessions
- Worker séparé pour emails, notifications, webhooks et synchronisations
- Stockage compatible S3 / Cloudflare R2
- Tests unitaires et integration API

## Démarrage frontend

Ce frontend peut être ouvert localement depuis `index.html` tant qu’il reste statique.

## Configuration future

Les variables d’environnement attendues pour le backend sont listées dans `.env.example`.
