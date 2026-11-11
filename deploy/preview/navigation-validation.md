# Navigation professionnelle : verification du 10 novembre 2026

## Causes et corrections

- L'accueil proposait toujours une connexion, meme avec des jetons presents.
  La navigation publique interroge maintenant `/auth/me` via le client API
  partage et affiche le lien vers l'espace correspondant au role confirme.
  Un role conserve localement ne suffit pas a attribuer des droits.
- La page de connexion redirige une session deja valide sans demander de
  nouveaux identifiants. `next` reste limite a une destination de meme origine,
  sans boucle vers connexion ou inscription. Les erreurs reseau ne suppriment
  pas les jetons.
- Les quatre publications conservent une navigation laterale sur grand ecran,
  repliable sur mobile, exterieure au conteneur rerendu par chaque etape.
- Le menu hotelier a des etats accessibles, une fermeture au clavier et un
  bouton Fermer. Le bouton d'ouverture inutile est masque sur grand ecran.
- Le badge Contacts hotelier utilise le total des contacts, pas celui des
  reservations.
- Un hebergement modifie declenche l'avertissement natif avant de quitter
  sans sauvegarde, meme lorsque le nom n'est pas encore saisi.

## Tests executes

`node --test --test-concurrency=1 tests/*.test.mjs` avec Playwright :
55 reussis, 1 ignore (ancienne recette distante voyages non configuree).
Les tests navigateur utilisent une API controlee ; ce resultat ne constitue
pas une nouvelle validation PostgreSQL ou des emails de production.

Apres les derniers ajustements : les suites navigation professionnelle,
publication hoteliere navigateur et rotation des jetons ont ete relancees :
24 reussis, aucun ignore. Largeurs de navigation : 360, 390, 1170 et 1440 px.
Le test couvre aussi les destinations de la navigation hoteliere, l'absence
de deconnexion et la conservation du nom entre etapes et ouvertures du menu.

Le correctif ne modifie ni le backend, ni les donnees de production.
Les travaux de recuperation de compte, verification email et envoi Resend
restent distincts : aucun de ces services n'est active par ce correctif UX.
