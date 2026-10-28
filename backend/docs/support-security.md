# Sécurité du support

Les routes `/support/tickets` et `/support/tickets/:id/messages` nécessitent
l’identité JWT authentifiée. Les listes sont limitées au propriétaire du
ticket, quel que soit son rôle. Le corps des requêtes ne peut fournir ni
propriétaire, ni auteur, ni identifiant alternatif de ticket.

Les messages sont autorisés uniquement pour les statuts `open` et `pending`.
Les tickets `resolved` et `closed` restent consultables dans la liste de leur
propriétaire, avec leur historique, mais ne peuvent plus recevoir de message.
Un ticket inexistant, appartenant à un tiers ou historique sans propriétaire
produit la même réponse HTTP 404. Les tickets résolus et fermés du propriétaire
produisent HTTP 409 lors d’une tentative d’ajout.

L’ajout utilise une transaction Prisma : lecture du ticket du propriétaire,
vérification du statut, mise à jour conditionnelle du ticket puis insertion du
message. La mise à jour conditionnelle porte à nouveau sur l’identifiant,
le propriétaire et les statuts autorisés. Elle verrouille la ligne jusqu’à
la fin de la transaction. Si un changement concurrent invalide ces conditions,
le message n’est pas inséré. L’échec de l’insertion annule aussi la mise à jour
de `updatedAt`. Aucun message historique n’est modifié ou supprimé.

Les sujets sont limités à 200 caractères et les messages à 10 000 caractères,
après suppression des espaces aux extrémités. Les textes vides sont refusés.
Ces limites sont centralisées dans `support.constants.ts`.

Il n’existe actuellement aucun endpoint administratif de gestion du support
dans le backend. La permission existante `access_admin` ne donnait aucun accès
transversal à ces routes : aucun accès supplémentaire ni rôle d’agent support
n’est ajouté. Un administrateur conserve l’accès à ses propres tickets. La
gestion administrative transversale et le traitement des tickets historiques
sans propriétaire restent à implémenter par un parcours explicitement protégé.

Les tests HTTP exécutent les guards JWT et permissions, le contrôleur, la
validation et le service réels avec Prisma simulé. Le scénario concurrent
simule une mise à jour conditionnelle refusée ; il ne remplace pas un test
de concurrence contre PostgreSQL réel. Aucune migration n’est nécessaire.
