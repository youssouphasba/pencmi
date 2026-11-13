# Administration des contenus

Pages modifiables : conditions d'utilisation, confidentialité, mentions légales, conseils de sécurité, règles de publication, conseils anti-arnaque ; et la FAQ du centre d'aide.

- Chaque page a un texte par défaut dans `content/content-defaults.mjs`, affiché tant qu'aucune version n'est publiée. L'éditeur admin part de ce texte au premier enregistrement.
- Une page enregistrée en brouillon n'est pas publique : le site garde la version publiée ou, à défaut, le texte par défaut.
- Chaque enregistrement conserve l'état précédent (30 versions au plus), rechargeable dans l'éditeur. Création et modification sont journalisées (`content.page_created`, `content.page_updated`).
- Texte brut uniquement : ligne vide pour un nouveau paragraphe, « - » en début de ligne pour une liste. Le site l'affiche via `textContent`, aucun HTML n'est interprété.
- FAQ : 300 questions au plus, catégorie, ordre, visibilité. Tant que la FAQ est vide, le centre d'aide affiche les questions par défaut ; le bouton « Partir des questions par défaut » les importe pour les modifier.

API publique : `GET /api/v1/content/pages/:slug` (null si non publiée), `GET /api/v1/content/faq`.
API admin (`manage_content`) : `GET /admin/content/pages`, `GET|PUT /admin/content/pages/:slug`, `GET /admin/content/pages/:slug/versions/:id`, `GET|POST /admin/content/faq`, `PATCH|DELETE /admin/content/faq/:id`.

Avant l'ouverture : compléter les mentions légales (raison sociale, adresse, NINEA/RCCM, responsable de publication) depuis l'admin ; le texte par défaut l'annonce par un avertissement.
