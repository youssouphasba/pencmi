# Assistant Pencmi

Interface : `/assistant/`. API authentifiee : `/assistant/capabilities`,
`/assistant/chat`, `/assistant/confirm`.

Configuration backend uniquement : DEEPSEEK_API_KEY, ASSISTANT_ENABLED=true,
ASSISTANT_ROLES=admin, ASSISTANT_MODEL=deepseek-flash,
ASSISTANT_BUDGET_CENTS=200. Desactive par defaut. Aucune migration.
Ne jamais publier la cle dans le frontend.

Le catalogue reutilise les routes metier et leurs controles JWT, permissions,
propriete et stock. Les ecritures exigent une confirmation signee, liee a la
session, valable cinq minutes et consommable une seule fois. Une erreur ambigue
impose de verifier l'espace utilisateur avant une nouvelle tentative.

Les donnees retournees par les services ne sont pas envoyees au modele.
Seuls les textes saisis, trois demandes precedentes et le role le sont, apres
consentement. Les textes affiches utilisent textContent. Aucun SQL ou acces URL
arbitraire n'est expose au modele.

Budget conservateur : reservation de 5 cents par appel, y compris les echecs,
plafond cumule de 200 cents, 20 appels par utilisateur sur 24 heures.
Les reservations AuditLog doivent etre conservees : leur suppression remettrait
le compteur a zero. Ce compteur ne remplace pas les limites du fournisseur et
ne couvre pas les autres applications utilisant la meme cle. Verifier les tarifs
avant toute modification du modele ou des limites de tokens.

Fonctions : recherche, consultation, favoris, lecture/pause des alertes,
demandes et decisions selon droits, messages existants, support, notifications,
brouillons des quatre univers (titre/description seulement), soumission native,
lecture de la file administrative. Pas de decision administrative automatique,
publication complete par conversation, upload, paiement ou execution autonome.
Les resultats ne sont pas reinjectes dans le modele : selectionner explicitement
un identifiant pour une action suivante. Aucun historique persistant du chat.

Validation : tests PostgreSQL isoles avec fournisseur simule, tests navigateur
360/1440 pixels avec API controlee, verification TypeScript. Test fournisseur
reel minimal : 11 tokens entree et 1 sortie, sans donnee utilisateur.
Les parcours metier complets via un modele reel restent a qualifier avant
ouverture aux clients. Activation production a effectuer apres cette recette.
