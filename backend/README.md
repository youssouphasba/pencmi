# Backend Péncmi

Backend NestJS pour Péncmi.

## Installation

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run start:dev
```

## Scripts

- `npm run start:dev` : API locale.
- `npm run build` : compilation.
- `npm run prisma:migrate` : migration locale.
- `npm run prisma:deploy` : migrations en production.
- `npm test` : tests unitaires.

## Architecture

- API versionnée sous `/api/v1`.
- Réponse API standardisée.
- Auth JWT avec refresh tokens et sessions.
- Prisma/PostgreSQL.
- Modules métiers séparés.
- Contenus éditoriaux prévus en base.
