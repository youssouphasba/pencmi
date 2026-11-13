import { UserRole } from '../../common/constants/roles';
import { ASSISTANT_TOOLS, canUseTool } from './assistant.catalog';

// What Guindi tells users it can do. Built only from the tools the role can really use,
// so the help panel and the model never promise an action Guindi cannot perform.
export const HELP_GROUPS = ['find', 'requests', 'saved', 'messages', 'listings', 'received', 'admin'] as const;
type Group = (typeof HELP_GROUPS)[number];
export const HELP_GROUP_TITLES: Record<Group, string> = {
  find: 'Trouver et comparer', requests: 'Mes demandes', saved: 'Favoris et alertes', messages: 'Messages et support',
  listings: 'Mes annonces', received: 'Demandes reçues', admin: 'Administration',
};
type Help = { group: Group; text: string; examples: string[] };
export const TOOL_HELP: Record<keyof typeof ASSISTANT_TOOLS, Help> = {
  search: { group: 'find', text: 'Chercher des logements, hôtels, voitures et trajets avec vos critères (ville, prix, dates, personnes…), puis comparer les résultats.',
    examples: ['Un hôtel à Saly pour 2 personnes ce week-end', 'Un trajet Dakar → Thiès demain matin', 'Un appartement meublé à louer à Dakar', 'Une voiture de location automatique à Dakar'] },
  listing: { group: 'find', text: 'Détailler une annonce : chambres, départs, places restantes, prix et conditions.', examples: ['Quelles chambres propose le premier hôtel ?'] },
  faq: { group: 'find', text: 'Répondre à vos questions sur le fonctionnement de Péncmi, d’après l’aide publiée.', examples: ['Comment fonctionne une demande de réservation ?'] },
  create_request: { group: 'requests', text: 'Préparer une demande de visite, de réservation, de location, de chauffeur ou de places. Ce n’est pas une réservation garantie.',
    examples: ['Réserve 2 places sur le départ de 7 h', 'Je veux visiter cet appartement samedi'] },
  my_requests: { group: 'requests', text: 'Suivre l’état de vos demandes.', examples: ['Où en sont mes demandes d’hôtel ?'] },
  cancel_request: { group: 'requests', text: 'Annuler une de vos demandes, selon les règles de l’annonceur.', examples: ['Annule ma demande de location'] },
  favorites: { group: 'saved', text: 'Afficher vos favoris.', examples: ['Montre mes favoris'] },
  add_favorite: { group: 'saved', text: 'Ajouter une annonce à vos favoris.', examples: ['Ajoute cet hôtel à mes favoris'] },
  remove_favorite: { group: 'saved', text: 'Retirer une annonce de vos favoris.', examples: ['Retire-le de mes favoris'] },
  alerts: { group: 'saved', text: 'Afficher vos alertes de recherche.', examples: ['Montre mes alertes'] },
  pause_alert: { group: 'saved', text: 'Mettre une alerte en pause.', examples: ['Mets en pause mon alerte sur Dakar'] },
  conversations: { group: 'messages', text: 'Afficher vos conversations.', examples: ['Montre mes conversations'] },
  messages: { group: 'messages', text: 'Ouvrir une conversation existante.', examples: ['Ouvre ma dernière conversation'] },
  send_message: { group: 'messages', text: 'Répondre dans une conversation existante.', examples: ['Réponds à l’agence que je confirme la visite jeudi'] },
  notifications: { group: 'messages', text: 'Afficher vos notifications.', examples: ['Ai-je des notifications ?'] },
  support: { group: 'messages', text: 'Suivre vos tickets de support.', examples: ['Où en est mon ticket de support ?'] },
  create_ticket: { group: 'messages', text: 'Écrire au support Péncmi.', examples: ['Contacte le support : je n’arrive pas à modifier mon téléphone'] },
  my_listings: { group: 'listings', text: 'Afficher vos annonces et leur statut.', examples: ['Affiche mes annonces'] },
  draft: { group: 'listings', text: 'Créer un brouillon d’annonce avec un titre et une description ; le reste se complète dans le formulaire.',
    examples: ['Crée un brouillon : villa 4 chambres à Saly, piscine, à vendre'] },
  submit: { group: 'listings', text: 'Soumettre une annonce complète à la validation.', examples: ['Soumets mon annonce à la validation'] },
  received_requests: { group: 'received', text: 'Afficher les demandes reçues de vos clients.', examples: ['Quelles demandes ai-je reçues ?'] },
  decide_request: { group: 'received', text: 'Accepter, refuser une demande reçue ou demander des précisions. Le serveur vérifie toujours la disponibilité.',
    examples: ['Accepte la première demande', 'Demande plus d’informations pour la deuxième'] },
  admin_queue: { group: 'admin', text: 'Lister les annonces en attente de validation (la décision reste la vôtre).', examples: ['Quelles annonces attendent une validation ?'] },
};

export function helpFor(role: UserRole) {
  return HELP_GROUPS.map(group => ({
    id: group, title: HELP_GROUP_TITLES[group],
    items: Object.entries(TOOL_HELP).filter(([name, help]) => help.group === group && canUseTool(role, name))
      .map(([name, help]) => ({ tool: name, text: help.text, examples: help.examples, confirmationRequired: !!ASSISTANT_TOOLS[name].write })),
  })).filter(group => group.items.length);
}

/** Plain-language capability list added to the system prompt. */
export function helpPrompt(role: UserRole) {
  return 'Ce que tu peux faire pour ce compte (si on te demande ce que tu sais faire, réponds à partir de cette liste et propose 2 ou 3 exemples) :\n' +
    helpFor(role).map(group => `- ${group.title} : ${group.items.map(item => item.text.replace(/\.$/, '')).join(' ; ')}.`).join('\n') +
    '\nTu ne peux pas : payer, envoyer des photos ou documents, publier ou valider une annonce, démarrer une nouvelle conversation.';
}
