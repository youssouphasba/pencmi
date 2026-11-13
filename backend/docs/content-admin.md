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

## SEO et GEO

- `/admin/seo/pages` : pour chaque page publique, remplacer le titre (10 à 70 caractères) et la description (50 à 170), ou retirer la page des moteurs de recherche. `seo/seo.js` applique le réglage après le texte intégré ; supprimer le réglage rétablit ce dernier. API : `GET /api/v1/seo/meta?path=` (public, chemins publics seulement), `GET|PUT /api/v1/admin/seo/meta`, `DELETE /api/v1/admin/seo/meta/:id` (`manage_content`, journalisé).
- Correction du 13 novembre 2026 : les entrées SEO intégrées n'avaient pas de chemin, et le script remplaçait l'URL canonique de chaque page publique par celle de l'accueil. Chaque page garde désormais sa propre URL canonique.
- GEO : `llms.txt`, `ai.txt` et `about-pencmi.txt` sont des fichiers publiés avec le site ; l'admin GEO les affiche et renvoie vers la FAQ et les pages SEO, qui sont les contenus modifiables.
- Les redirections 301 dépendent de l'hébergement du site public ; elles seront configurées avec le domaine.
