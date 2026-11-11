# Recuperation de compte et emails transactionnels

## Perimetre implemente

- `GET /auth/recovery-capabilities` annonce la disponibilite effective de la
  configuration, sans exposer de cle ni de details de fournisseur.
- `POST /auth/forgot-password` accepte un email valide. Meme reponse pour un
  compte inconnu, suspendu, supprime ou eligible. Aucun jeton dans la reponse.
- Creation transactionnelle du hash SHA-256 dans `PasswordResetToken` et d'un
  email chiffre AES-256-GCM dans `EmailLog`. Le chiffrement est lie a l'ID du
  message. Les deux tables existaient deja : aucune migration.
- Jeton aleatoire 256 bits, expiration 30 minutes, consommation unique sous
  verrou PostgreSQL. Une demande ne revoque pas les anciens liens : cela evite
  de bloquer un utilisateur par des demandes malveillantes repetees.
- Limites : 5 demandes par IP / 15 minutes, une creation par compte / minute
  et au maximum cinq / heure. Les limites par compte sont transactionnelles ;
  le throttler IP existant reste local a chaque instance.
- `POST /auth/reset-password` applique la politique existante : 12 caracteres,
  majuscule, minuscule, chiffre, symbole, maximum 72 octets. La reinitialisation
  consomme les liens du compte et revoque toutes ses sessions et refresh tokens.
  Le changement de mot de passe authentifie invalide egalement ces liens.
- Le lien utilise un fragment `#token=`, non transmis au serveur HTTP. Le
  formulaire retire le fragment de la barre d'adresse et garde le jeton en
  memoire seulement. Apres rechargement, rouvrir le lien recu par email.
- Formulaires mobile/desktop : disponibilite verifiee, erreurs reseau sans
  faux succes, boutons bloques pendant la requete, confirmation serveur.

## Worker et Resend

`npm run start:emails` lance `dist/email-worker.js`, sans serveur HTTP et sans
activer le processeur d'alertes de recherche. Ne pas lancer ce worker dans le
processus API. Un service Railway distinct est necessaire en production.

Le worker traite uniquement les messages `password-reset-v1`. Les anciens
emails en attente ne sont pas envoyes automatiquement. Verrou `SKIP LOCKED`,
timeout fournisseur 10 secondes, cinq tentatives maximum avec attente, aucune
relance apres expiration du lien. Cle d'idempotence stable par message :
https://resend.com/docs/dashboard/emails/idempotency-keys

La fenetre de relance de 30 minutes reste inferieure aux 24 heures de retention
des cles chez Resend. Le contenu et l'expediteur sont figes dans l'enveloppe
chiffree pour ne pas changer le payload entre tentatives. `sent` signifie
accepte par le fournisseur, pas livre en boite de reception. Les rebonds et
webhooks de livraison ne sont pas implementes dans ce lot.

L'enveloppe est effacee apres succes, echec terminal ou annulation. Les logs
administratifs ne retournent jamais `payload`. Les erreurs de transport ne
journalisent ni le corps fournisseur, ni le lien, ni les credentials.

Le template `account.password_reset` peut remplacer les valeurs par defaut
du module `recovery-email.ts` via `EmailTemplate`. Le corps texte doit contenir
`{{resetUrl}}`. Un template desactive ou mal configure bloque globalement les
demandes sans reveler l'existence d'un compte. L'edition graphique des templates
n'est pas ajoutee dans ce lot.

## Activation volontaire uniquement

La valeur par defaut `PASSWORD_RECOVERY_ENABLED=false` conserve l'indisponibilite
explicite. Les formulaires n'annoncent aucun envoi lorsque le service est coupe.
Ne pas activer en production avant validation de :

1. Domaine et expediteur verifies dans Resend ; renseigner `EMAIL_FROM`.
2. `RESEND_API_KEY` configuree directement dans le gestionnaire de secrets.
3. `EMAIL_QUEUE_ENCRYPTION_KEY`, 32 octets aleatoires encodes en 64 caracteres
   hexadecimaux, identique sur API et worker, distincte des secrets JWT.
4. `FRONTEND_URL` : origine HTTPS du vrai frontend, pas celle du backend.
5. Worker operationnel, supervision des echecs et test de livraison vers une
   adresse autorisee. Puis `PASSWORD_RECOVERY_ENABLED=true` sur API et worker.

Ne pas changer la cle de chiffrement avec des messages en attente : ils
deviendraient illisibles. Conserver la cle dans les sauvegardes securisees.
Une configuration invalide refuse la recuperation et le demarrage du worker.
Le service ne tente pas de recuperation par telephone ou SMS.

## Tests et limites

`password-recovery-postgres.spec.ts` refuse toute base non locale ou non suffixee
`_test`. Les jetons et mots de passe sont generes a l'execution. Vrais appels
Prisma, verrous et concurrence PostgreSQL ; transport Resend remplace en test.
La suite couvre reinitialisation concurrente, sessions revoquees, rejeu, compte
inactif, expiration, invalidation par changement de mot de passe, file chiffree,
concurrence des workers, retries, annulation et erreurs de fournisseur.

`tests/account-recovery.browser.test.mjs` verifie les formulaires sur deux
largeurs avec une API controlee, sans envoyer d'email reel.

La verification d'email, le SMS, les autres emails metier, le suivi des rebonds
et la suppression de compte restent des chantiers distincts. La reinitialisation
ne positionne pas arbitrairement `emailVerified` a vrai. Aucun nouveau service
Railway payant ni variable de production n'est cree ou active dans ce lot.

Validation du 11 novembre 2026 : 593 tests backend reussis, 2 tests de stockage
distant ignores ; 56 tests frontend reussis, 1 ancien parcours de recette
distante ignore. Build NestJS, controle TypeScript et lint cible reussis.
Audit en lecture seule sur `pencmi_step15_test` : sept migrations appliquees,
checksums conformes, aucun ecart de schema. Aucune livraison d'email reel
n'est attestee par ces tests.
