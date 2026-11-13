# Guindi, assistant Pencmi

Interface : `/assistant/` (lien « Guindi (assistant IA) » dans la navigation admin).
API authentifiee : `/assistant/capabilities`, `/assistant/chat`, `/assistant/confirm`.

Configuration backend uniquement : DEEPSEEK_API_KEY, ASSISTANT_ENABLED=true,
ASSISTANT_ROLES=admin, ASSISTANT_MODEL=deepseek-flash (DeepSeek-V4.1-Flash,
appele sans mode reflexion), ASSISTANT_BUDGET_CENTS=500 (budget MENSUEL, max 10000).
Desactive par defaut. Aucune migration. Ne jamais publier la cle dans le frontend.

## Boucle
Un message utilisateur declenche au plus 3 appels au modele et 3 outils par appel.
Les outils de lecture s'executent cote serveur, avec le jeton de l'utilisateur, via
les routes metier (JWT, permissions, propriete, stock). Le dernier appel est force
en reponse texte (`tool_choice: none`). Une ecriture produit une proposition et
termine le tour : le modele n'est pas rappele.

## Ce que voit le modele
Chaque outil a un niveau `context` (assistant.catalog.ts), filtre par liste blanche
(assistant.summary.ts) :
- `public` (recherche, fiche, FAQ) : titre, ville, prix, chambres, departs, places...
  Jamais le proprietaire, les coordonnees ou les photos.
- `refs` (favoris, alertes, mes demandes, demandes recues, mes annonces, file admin) :
  identifiants, statuts, dates, titres d'annonces. Pas de nom de personne,
  telephone, email ni texte libre.
- aucun (messages, conversations, notifications, support) : seulement le nombre
  d'elements.
Le resultat complet va toujours au navigateur, rendu en textContent.

## Memoire
Pas d'historique persistant. Le navigateur renvoie les 12 derniers tours
(user/assistant). Le tour assistant est le `memo` renvoye par le serveur : texte de
la reponse + vues filtrees des outils, ce qui permet « reserve la deuxieme ».
Le role `system` est refuse dans l'historique.

## Confirmation
Proposition signee (HMAC JWT_SECRET), liee a l'utilisateur, la session et le role,
valable 5 minutes, consommable une seule fois (AuditLog id = nonce). Une erreur
ambigue impose de verifier l'espace utilisateur avant une nouvelle tentative.

## Budget
Avant chaque appel : reservation pessimiste (octets/2 tokens d'entree + 800 de
sortie) au tarif heure pleine cache-miss (0,30 $/M entree, 1,20 $/M sortie).
Apres reponse : remplacee par le cout reel (`usage`). Une erreur conserve
l'estimation. Plafond par mois calendaire UTC, 60 appels modele par utilisateur
sur 24 h, 5 messages/minute. Conserver les lignes AuditLog
`assistant.budget_reserved`. Verifier les tarifs avant de changer de modele.
Plafond atteint : message neutre pour l'utilisateur (aucune mention du budget),
avertissement "Monthly budget reached" dans les logs Railway.

## Tests
- assistant.service.spec.ts : boucle, filtrage, proposition, bornes (sans base).
- assistant-postgres.spec.ts : API reelle sur PostgreSQL isole, modele simule.
- tests/assistant.browser.test.mjs : cartes, memoire, confirmation, XSS, 360/1440 px.
