// Default text of the public pages, shown until an admin publishes a version from the
// back-office. Body format: paragraphs separated by a blank line, list items start with "- ".

export const PAGE_SLUGS = {
  conditions: 'conditions',
  privacy: 'confidentialite',
  legalNotice: 'mentions-legales',
  security: 'securite',
  publishingRules: 'regles-publication',
  antiScam: 'conseils-anti-arnaque',
};

export const PAGE_ACTIONS = {
  confidentialite: { label: 'Gérer mes paramètres', href: '/compte/parametres' },
  securite: { label: 'Signaler un problème', href: '/signaler' },
  'conseils-anti-arnaque': { label: 'Signaler une annonce suspecte', href: '/signaler' },
};

export const DEFAULT_PAGES = {
  conditions: {
    title: 'Conditions d’utilisation',
    subtitle: 'Les règles d’utilisation de Péncmi pour les clients, annonceurs et professionnels.',
    sections: [
      { heading: 'Objet de la plateforme', body: 'Péncmi met en relation des personnes qui cherchent un logement, une chambre d’hôtel, un véhicule ou une place dans un trajet interurbain au Sénégal avec les particuliers et professionnels qui les proposent.\n\nPéncmi n’est ni propriétaire, ni loueur, ni vendeur, ni transporteur : la location, la vente, la réservation ou le trajet sont conclus directement entre le client et l’annonceur.' },
      { heading: 'Création de compte', body: 'Un compte est personnel. Les informations fournies doivent être exactes et tenues à jour. Vous êtes responsable de la confidentialité de votre mot de passe et des actions réalisées depuis votre compte.\n\nUn compte professionnel (agence, hôtel, loueur, transporteur…) engage l’activité qu’il représente.' },
      { heading: 'Règles pour les clients', body: '- Utiliser les demandes et la messagerie uniquement pour une démarche réelle.\n- Ne pas harceler, insulter ou menacer un annonceur.\n- Vérifier les informations importantes avant tout engagement ou paiement.' },
      { heading: 'Règles pour les annonceurs', body: '- Publier uniquement des biens, chambres, véhicules ou trajets réellement disponibles et que vous avez le droit de proposer.\n- Afficher des prix, photos et descriptions conformes à la réalité.\n- Répondre aux demandes dans un délai raisonnable et tenir vos disponibilités à jour.\n- Respecter les règles de publication de Péncmi.' },
      { heading: 'Publication et validation des annonces', body: 'Chaque annonce est examinée par l’équipe Péncmi avant d’être visible. Une annonce peut être refusée, suspendue ou retirée si elle ne respecte pas les règles de publication ; le motif est communiqué à l’annonceur.' },
      { heading: 'Vérification des professionnels', body: 'Un professionnel peut faire vérifier son activité en envoyant ses justificatifs. Le badge « Professionnel vérifié » indique que ces documents ont été contrôlés à une date donnée ; il ne garantit pas chaque annonce ni chaque transaction.' },
      { heading: 'Demandes, messages et contacts', body: 'Les demandes de visite, de réservation, de location ou de place sont des demandes : elles n’engagent l’annonceur qu’après son acceptation. Les échanges doivent rester courtois et liés à l’annonce.' },
      { heading: 'Signalements', body: 'Tout utilisateur peut signaler une annonce, un compte ou un message. L’équipe Péncmi examine les signalements et peut prendre les mesures nécessaires.' },
      { heading: 'Suspension et suppression', body: 'Péncmi peut suspendre ou supprimer un contenu ou un compte en cas de fraude, de contenu illicite, de non-respect de ces conditions ou de signalements répétés et fondés.' },
      { heading: 'Responsabilités', body: 'Les annonceurs sont responsables du contenu de leurs annonces et de l’exécution des engagements pris avec leurs clients. Péncmi met en œuvre des moyens raisonnables pour modérer la plateforme mais ne peut garantir l’exactitude de toutes les informations publiées par les utilisateurs.' },
      { heading: 'Données personnelles', body: 'Le traitement de vos données est décrit dans la politique de confidentialité.' },
      { heading: 'Modification des conditions', body: 'Ces conditions peuvent évoluer. La version en vigueur est celle publiée sur cette page ; en cas de changement important, les utilisateurs en sont informés.' },
      { heading: 'Contact', body: 'Pour toute question, utilisez la page Contact.' },
    ],
  },
  confidentialite: {
    title: 'Politique de confidentialité',
    subtitle: 'Comment Péncmi collecte, utilise et protège vos données.',
    sections: [
      { heading: 'Cadre', body: 'Péncmi traite vos données personnelles dans le respect de la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel.' },
      { heading: 'Données collectées', body: '- Compte : nom, email, téléphone, rôle, mot de passe (stocké sous forme chiffrée irréversible).\n- Profil professionnel : nom commercial, ville, coordonnées professionnelles, logo.\n- Annonces : textes, prix, photos, localisation.\n- Demandes et messages échangés sur la plateforme.\n- Favoris, recherches sauvegardées et préférences de notification.\n- Documents de vérification envoyés par les professionnels.\n- Données techniques : journaux de connexion et de sécurité.' },
      { heading: 'Utilisation des données', body: '- Faire fonctionner votre compte, vos annonces, vos demandes et la messagerie.\n- Modérer les annonces et traiter les signalements.\n- Vérifier les professionnels qui le demandent.\n- Vous envoyer les notifications et emails liés à votre activité.\n- Assurer la sécurité de la plateforme et prévenir la fraude.\n- Produire des statistiques d’utilisation.' },
      { heading: 'Partage des données', body: 'Les informations nécessaires à une demande sont transmises à l’annonceur concerné (et inversement). Vos données ne sont pas vendues. Elles peuvent être confiées à nos prestataires techniques (hébergement, stockage de fichiers, envoi d’emails), tenus à la confidentialité, ou communiquées aux autorités lorsque la loi l’exige.' },
      { heading: 'Documents de vérification', body: 'Les justificatifs envoyés pour la vérification sont stockés de façon privée, consultés uniquement par l’équipe Péncmi et supprimés dès que la décision est prise.' },
      { heading: 'Conservation', body: 'Les données de compte sont conservées tant que le compte est actif. À la fermeture du compte, elles sont supprimées ou anonymisées, sauf celles qu’une obligation légale ou la sécurité de la plateforme impose de garder pendant une durée limitée.' },
      { heading: 'Sécurité', body: 'Connexions chiffrées, mots de passe hachés, sessions révocables, contrôle des accès et journalisation des actions sensibles protègent vos données.' },
      { heading: 'Vos droits', body: 'Vous pouvez accéder à vos données, les rectifier, vous opposer à certains traitements et demander leur suppression. La plupart de ces actions sont disponibles dans les paramètres de votre compte ; sinon, contactez-nous. Vous pouvez aussi saisir la Commission de Protection des Données Personnelles (CDP) du Sénégal.' },
      { heading: 'Contact confidentialité', body: 'Pour toute question sur vos données, utilisez la page Contact en choisissant la catégorie « Problème de compte ».' },
    ],
  },
  'mentions-legales': {
    title: 'Mentions légales',
    subtitle: 'Informations relatives au site Péncmi.',
    warning: 'Les informations légales complètes (raison sociale, adresse, identifiants) seront publiées avant l’ouverture officielle du service.',
    sections: [
      { heading: 'Éditeur du site', body: 'Le site est édité par Péncmi.' },
      { heading: 'Hébergement', body: 'Le service est hébergé par Railway Corporation (États-Unis). Les fichiers sont stockés chez Cloudflare (R2).' },
      { heading: 'Propriété intellectuelle', body: 'La marque, le logo et les éléments graphiques de Péncmi sont protégés. Les contenus publiés par les utilisateurs restent leur propriété ; en les publiant, ils autorisent Péncmi à les afficher sur la plateforme.' },
      { heading: 'Signalement de contenu', body: 'Pour signaler un contenu illicite, utilisez le bouton « Signaler » présent sur les annonces et les profils, ou la page Signaler.' },
      { heading: 'Données personnelles', body: 'Voir la politique de confidentialité.' },
    ],
  },
  securite: {
    title: 'Conseils de sécurité',
    subtitle: 'Adoptez les bons réflexes avant de vous engager avec un annonceur ou un client.',
    sections: [
      { heading: 'Conseils généraux', body: '- Échangez via la messagerie Péncmi : elle garde une trace de vos échanges.\n- Ne communiquez jamais vos mots de passe ni les codes reçus par SMS.\n- Méfiez-vous des offres nettement moins chères que le marché.\n- Préférez les annonceurs au badge « Professionnel vérifié ».' },
      { heading: 'Immobilier', body: '- Visitez le bien avant de verser de l’argent.\n- Demandez à voir un justificatif de propriété ou un mandat de l’agence.\n- Exigez un reçu pour toute somme versée.' },
      { heading: 'Hôtels', body: '- Vérifiez les dates, le nombre de voyageurs et le prix total avant de confirmer.\n- Une réservation n’est garantie qu’une fois acceptée par l’établissement.' },
      { heading: 'Voitures', body: '- Inspectez le véhicule et vérifiez la carte grise, l’assurance et la visite technique.\n- Pour un achat, ne payez qu’après avoir vu le véhicule et les documents originaux.' },
      { heading: 'Voyages', body: '- Vérifiez le lieu et l’heure de départ, et le nombre de places confirmées.\n- Partagez les informations de votre trajet avec un proche.' },
      { heading: 'Paiements', body: 'Ne payez jamais par un moyen que vous ne pouvez pas retracer à une personne inconnue, et méfiez-vous de toute pression pour payer vite.' },
      { heading: 'Signaler', body: 'Un doute ? Signalez l’annonce ou le compte : l’équipe Péncmi examine chaque signalement.' },
    ],
  },
  'regles-publication': {
    title: 'Règles de publication des annonces',
    subtitle: 'Les annonces doivent être claires, honnêtes et conformes aux règles de Péncmi.',
    sections: [
      { heading: 'Règles communes', body: '- Une annonce correspond à un seul bien, établissement, véhicule ou trajet réellement disponible.\n- Le titre et la description décrivent fidèlement l’offre.\n- Les doublons sont interdits.' },
      { heading: 'Photos', body: '- Photos réelles et récentes de l’offre, sans filigrane d’un autre site.\n- Pas de photos de personnes identifiables sans leur accord.\n- Pas de coordonnées ni de publicité incrustées dans les photos.' },
      { heading: 'Prix', body: 'Le prix affiché est le prix réellement demandé, en francs CFA, avec les frais obligatoires indiqués (caution, frais d’agence, frais de service…).' },
      { heading: 'Coordonnées', body: 'Les coordonnées se renseignent dans les champs prévus, pas dans le titre ou la description.' },
      { heading: 'Immobilier', body: 'Précisez la ville, le quartier, la surface et les conditions (location ou vente, caution, durée). Vous devez être propriétaire ou mandaté.' },
      { heading: 'Hôtels', body: 'Les chambres, tarifs et disponibilités doivent être à jour. Les conditions d’annulation sont indiquées clairement.' },
      { heading: 'Voitures', body: 'Indiquez l’état réel du véhicule, son kilométrage et les documents disponibles. La location exige un véhicule assuré.' },
      { heading: 'Voyages', body: 'Indiquez les villes, horaires et le nombre de places réels. Le transport de personnes doit respecter la réglementation en vigueur.' },
      { heading: 'Contenus interdits', body: '- Biens ou services illégaux, contrefaçons.\n- Contenus haineux, violents, discriminatoires ou à caractère sexuel.\n- Annonces trompeuses, appâts ou arnaques.' },
      { heading: 'Validation, refus et suspension', body: 'Chaque annonce est vérifiée avant publication. Une annonce non conforme est refusée avec un motif ; elle peut être corrigée puis soumise de nouveau. Une annonce publiée peut être suspendue après un signalement fondé.' },
    ],
  },
  'conseils-anti-arnaque': {
    title: 'Éviter les arnaques',
    subtitle: 'Quelques conseils pour utiliser Péncmi avec prudence.',
    sections: [
      { heading: 'Reconnaître une annonce suspecte', body: '- Prix très inférieur au marché.\n- Photos trop belles, reprises d’autres sites ou sans rapport avec la ville.\n- Description vague, fautes nombreuses, insistance sur l’urgence.' },
      { heading: 'Reconnaître un faux annonceur', body: '- Refus de faire visiter ou de montrer le véhicule.\n- Prétexte d’être à l’étranger et de devoir envoyer les clés.\n- Demande de poursuivre la discussion hors de Péncmi dès le premier message.' },
      { heading: 'Avant de payer', body: 'Ne versez jamais d’acompte avant d’avoir visité le bien, vu le véhicule ou reçu la confirmation de l’établissement. Refusez les paiements par des moyens non traçables et exigez un reçu.' },
      { heading: 'Avant une visite', body: 'Rendez-vous de jour, prévenez un proche et méfiez-vous d’un changement de lieu de dernière minute.' },
      { heading: 'Avant une réservation', body: 'Vérifiez que votre demande est bien acceptée sur Péncmi et que le prix total correspond à l’annonce.' },
      { heading: 'Avant d’acheter une voiture', body: 'Contrôlez la carte grise originale, la correspondance du numéro de châssis et l’absence de gage. Faites inspecter le véhicule.' },
      { heading: 'Avant un trajet', body: 'Confirmez le lieu de départ, l’horaire et l’identité du transporteur via la messagerie Péncmi.' },
      { heading: 'Comment signaler', body: 'Utilisez le bouton « Signaler » sur l’annonce ou le profil. Si vous avez été victime d’une escroquerie, déposez aussi plainte auprès de la police ou de la gendarmerie.' },
    ],
  },
};

export const FAQ_CATEGORY_LABELS = {
  account: 'Compte et connexion',
  search: 'Rechercher une annonce',
  contact: 'Contacter un annonceur',
  saved: 'Favoris et alertes',
  real_estate: 'Immobilier',
  hotels: 'Hôtels & Auberges',
  vehicles: 'Voitures',
  trips: 'Voyages interurbains',
  publish: 'Publier une annonce',
  verification: 'Vérification et badges',
  safety: 'Signalements et sécurité',
  notifications: 'Notifications et emails',
};

export const DEFAULT_FAQ = [
  { category: 'account', question: 'Comment créer un compte ?', answer: 'Cliquez sur « Inscription », choisissez votre type de compte (client ou professionnel) et renseignez vos informations.' },
  { category: 'account', question: 'J’ai oublié mon mot de passe.', answer: 'Utilisez « Mot de passe oublié » sur la page de connexion pour recevoir un lien de réinitialisation.' },
  { category: 'search', question: 'Comment trouver une annonce près de chez moi ?', answer: 'Utilisez les filtres de ville, de quartier et de prix, ou la carte, dans chaque univers : immobilier, hôtels, voitures et voyages.' },
  { category: 'contact', question: 'Comment contacter un annonceur ?', answer: 'Depuis l’annonce, envoyez une demande (visite, réservation, location, place) ou un message. Vous suivez vos demandes dans votre espace.' },
  { category: 'contact', question: 'Puis-je annuler une demande ?', answer: 'Oui, depuis votre espace client, tant que la demande n’est pas terminée.' },
  { category: 'saved', question: 'Comment être prévenu des nouvelles annonces ?', answer: 'Enregistrez votre recherche : Péncmi vous notifie lorsqu’une nouvelle annonce correspond à vos critères.' },
  { category: 'hotels', question: 'Ma réservation d’hôtel est-elle confirmée ?', answer: 'Elle l’est quand l’établissement l’accepte. Vous recevez alors une notification et le statut change dans votre espace.' },
  { category: 'publish', question: 'Comment publier une annonce ?', answer: 'Créez un compte professionnel, puis utilisez « Publier ». Votre annonce est vérifiée par l’équipe Péncmi avant d’être visible.' },
  { category: 'publish', question: 'Pourquoi mon annonce a-t-elle été refusée ?', answer: 'Le motif vous est indiqué dans votre espace. Corrigez l’annonce selon les règles de publication puis soumettez-la de nouveau.' },
  { category: 'verification', question: 'Que signifie le badge « Professionnel vérifié » ?', answer: 'L’annonceur a envoyé des justificatifs (identité, registre de commerce…) contrôlés par l’équipe Péncmi.' },
  { category: 'verification', question: 'Comment faire vérifier mon activité ?', answer: 'Depuis votre dashboard, ouvrez « Vérification » et envoyez les documents demandés pour votre type de compte.' },
  { category: 'safety', question: 'Comment signaler une annonce suspecte ?', answer: 'Utilisez le bouton « Signaler » sur l’annonce. Consultez aussi nos conseils anti-arnaque.' },
  { category: 'notifications', question: 'Comment gérer mes notifications ?', answer: 'Dans les paramètres de votre compte, choisissez les notifications et emails que vous souhaitez recevoir.' },
];
