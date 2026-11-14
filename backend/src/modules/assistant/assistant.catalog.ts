import { z } from 'zod';
import { Permission, hasPermission } from '../../common/constants/permissions';
import { UserRole } from '../../common/constants/roles';

const moduleSchema = z.enum(['real_estate', 'hotels', 'vehicles', 'trips']);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const text = z.string().trim().min(1).max(2000);
const optionalText = z.string().trim().max(150).optional();
const number = z.number().int().min(0).max(2147483647).optional();
const paths: Record<string, string> = { real_estate: 'immobilier', hotels: 'hotels', vehicles: 'voitures', trips: 'voyages' };
const publish: Record<string, Permission> = { real_estate: 'publish_real_estate', hotels: 'publish_hotel', vehicles: 'publish_vehicle', trips: 'publish_trip' };
export type ToolRequest = { path: string; method: string; body?: Record<string, unknown> };
// context: what the model may see of a read result. 'public' = whitelisted summary of published listings/FAQ;
// 'refs' = identifiers, statuses, dates and listing titles only (no person names, contacts or message bodies);
// absent = only the number of items. The full result always goes to the browser.
export type ToolContext = 'public' | 'refs';
type Tool = { label: string; description: string; schema: z.ZodType; write?: boolean; context?: ToolContext; permission?: Permission;
  allowed?: (role: UserRole, args: any) => boolean; request: (args: any, nonce: string) => ToolRequest };
const get = (path: string, query: Record<string, unknown> = {}): ToolRequest => ({ method: 'GET', path: path + '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
const listing = z.object({ module: moduleSchema, id }).strict();
const empty = z.object({}).strict();
const requestType = z.enum(['visit', 'hotel', 'rental', 'chauffeur', 'trip']);
const requestPaths: Record<string, string> = { visit: '/immobilier', hotel: '/hotels', rental: '/voitures', chauffeur: '/voitures', trip: '/voyages' };
const requestSuffix: Record<string, string> = { visit: 'visit-requests', hotel: 'reservation-requests', rental: 'rental-requests', chauffeur: 'chauffeur-requests', trip: 'seat-requests' };
const managedRequests: Record<string, readonly [string, Permission]> = { hotel: ['/dashboard/hotels/reservations', 'manage_hotels'], rental: ['/dashboard/voitures/rental-requests', 'manage_vehicles'], chauffeur: ['/dashboard/voitures/chauffeur-requests', 'manage_vehicles'], trip: ['/dashboard/voyages/seat-requests', 'manage_trips'] };
const filters = z.object({ city: optionalText, transaction: optionalText, propertyType: optionalText, furnished: z.literal('true').optional(),
  maxPrice: number, minPrice: number, query: optionalText, stars: z.number().int().min(1).max(5).optional(), amenity: optionalText,
  checkIn: optionalText, checkOut: optionalText, guests: number, rooms: number, vehicleMode: z.enum(['sale', 'rental', 'chauffeur']).optional(),
  brand: optionalText, model: optionalText, fuel: optionalText, gearbox: optionalText, departureCity: optionalText, arrivalCity: optionalText,
  date: optionalText, passengers: number, vehicleType: optionalText, timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  page: z.number().int().min(1).max(100).optional() }).strict();
export const ASSISTANT_TOOLS: Record<string, Tool> = {
  faq: { label: 'Aide Péncmi', description: 'Lire la FAQ publiée. Ne pas inventer de politique commerciale.', schema: empty, context: 'public', request: () => get('/content/faq') },
  search: { label: 'Rechercher des annonces', description: 'Rechercher dans un univers. Utiliser uniquement les filtres de cet univers. Les résultats ne garantissent pas une réservation.',
    schema: z.object({ module: moduleSchema, filters }).strict(), context: 'public', request: a => get('/' + paths[a.module], { ...a.filters, limit: 6 }) },
  listing: { label: 'Consulter une annonce', description: 'Lire une annonce publique par son identifiant réel (chambres, départs, prix, conditions).', schema: listing, context: 'public', request: a => get(`/${paths[a.module]}/${a.id}`) },
  my_listings: { label: 'Mes annonces', description: 'Lire les annonces du professionnel connecté.', schema: z.object({ module: moduleSchema }).strict(), context: 'refs',
    allowed: (role, a) => hasPermission(role, publish[a.module]), request: a => get(`/dashboard/${paths[a.module]}`, { limit: 10 }) },
  favorites: { label: 'Mes favoris', description: 'Consulter mes favoris.', schema: empty, context: 'refs', request: () => get('/favorites', { limit: 10 }) },
  add_favorite: { label: 'Ajouter aux favoris', description: 'Ajouter une annonce aux favoris après confirmation.', schema: listing, write: true, request: a => ({ method: 'PUT', path: `/favorites/${a.module}/${a.id}` }) },
  remove_favorite: { label: 'Retirer des favoris', description: 'Retirer une annonce des favoris après confirmation.', schema: listing, write: true, request: a => ({ method: 'DELETE', path: `/favorites/${a.module}/${a.id}` }) },
  alerts: { label: 'Mes alertes', description: 'Lire mes recherches sauvegardées.', schema: empty, context: 'refs', request: () => get('/saved-alerts', { limit: 10 }) },
  pause_alert: { label: 'Mettre une alerte en pause', description: 'Désactiver une alerte existante, après confirmation.', schema: z.object({ id }).strict(), write: true, request: a => ({ method: 'PATCH', path: `/saved-alerts/${a.id}`, body: { active: false } }) },
  my_requests: { label: 'Mes demandes', description: 'Lire les demandes du client connecté, sans inventer leur statut.', schema: z.object({ type: requestType }).strict(), context: 'refs', request: a => get('/compte/requests', { type: a.type, limit: 10 }) },
  received_requests: { label: 'Demandes reçues', description: 'Lire les demandes reçues par le professionnel.', schema: z.object({ type: z.enum(['hotel', 'rental', 'chauffeur', 'trip']) }).strict(), context: 'refs',
    allowed: (role, a) => hasPermission(role, managedRequests[a.type][1]), request: a => get(managedRequests[a.type][0], { limit: 10 }) },
  decide_request: { label: 'Traiter une demande', description: 'Proposer une décision sur une demande reçue. Une acceptation reste soumise au stock et aux règles du serveur.',
    schema: z.object({ type: z.enum(['hotel', 'rental', 'chauffeur', 'trip']), id, status: z.enum(['pending', 'accepted', 'refused', 'cancelled', 'requires_more_info']) }).strict(), write: true,
    allowed: (role, a) => hasPermission(role, managedRequests[a.type][1]), request: a => ({ method: 'PATCH', path: `${managedRequests[a.type][0]}/${a.id}/status`, body: { status: a.status } }) },
  create_request: { label: 'Envoyer une demande', description: 'Proposer une demande, pas une réservation garantie. Le nom, le téléphone et l’email sont repris du compte connecté : ne les demande pas, sauf si l’utilisateur veut en donner d’autres. Hôtel : roomId, checkIn, checkOut, guests, units. Voyage : occurrenceId, requestedSeats. Location : startDate, endDate. Ne jamais inventer ces valeurs.',
    schema: z.object({ type: requestType, id, details: z.object({ clientName: z.string().trim().min(2).max(120).optional(), clientEmail: z.string().email().optional(), clientPhone: z.string().max(30).optional(), message: text.optional(),
      preferredDate: optionalText, roomId: id.optional(), checkIn: optionalText, checkOut: optionalText, guests: z.number().int().min(1).max(100).optional(), units: z.number().int().min(1).max(10).optional(),
      startDate: optionalText, endDate: optionalText, occurrenceId: id.optional(), requestedSeats: z.number().int().min(1).max(200).optional() }).strict() }).strict(), write: true,
    request: (a, nonce) => ({ method: 'POST', path: `${requestPaths[a.type]}/${a.id}/${requestSuffix[a.type]}`, body: { ...a.details, requestId: nonce } }) },
  cancel_request: { label: 'Annuler une demande', description: 'Demander une annulation selon les règles métier. Confirmation nécessaire.',
    schema: z.object({ type: z.enum(['visit', 'hotel', 'rental', 'chauffeur', 'trip']), id }).strict(), write: true,
    request: a => ({ method: 'POST', path: `/compte/requests/${a.type}/${a.id}/cancel` }) },
  conversations: { label: 'Mes conversations', description: 'Lire mes conversations.', schema: empty, request: () => get('/messages/conversations', { limit: 10 }) },
  messages: { label: 'Lire une conversation', description: 'Lire une conversation à laquelle appartient le compte connecté.', schema: z.object({ id }).strict(), request: a => get(`/messages/conversations/${a.id}`, { limit: 10 }) },
  send_message: { label: 'Envoyer un message', description: 'Proposer un message dans une conversation existante. Ne jamais inventer le destinataire.', schema: z.object({ id, body: text }).strict(), write: true,
    request: (a, nonce) => ({ method: 'POST', path: `/messages/conversations/${a.id}/messages`, body: { body: a.body, requestId: nonce } }) },
  notifications: { label: 'Mes notifications', description: 'Lire mes notifications internes.', schema: empty, request: () => get('/notifications') },
  support: { label: 'Mes tickets de support', description: 'Lire les tickets de support du compte connecté.', schema: empty, request: () => get('/support/tickets') },
  create_ticket: { label: 'Contacter le support', description: 'Proposer un nouveau ticket de support avec un sujet et un message.', schema: z.object({ subject: z.string().trim().min(1).max(150), body: text }).strict(), write: true,
    request: a => ({ method: 'POST', path: '/support/tickets', body: a }) },
  draft: { label: 'Créer un brouillon', description: 'Créer un brouillon incomplet avec titre et description seulement. Les autres champs se complètent dans le formulaire. Ne publie rien.',
    schema: z.object({ module: moduleSchema, title: z.string().trim().min(1).max(150), description: text, vehicleMode: z.enum(['sale', 'rental', 'chauffeur']).optional() }).strict(), write: true,
    allowed: (role, a) => hasPermission(role, publish[a.module]),
    request: (a, nonce) => ({ method: 'POST', path: `/dashboard/${paths[a.module]}`, body: a.module === 'trips'
      ? { requestId: nonce, publication: { content: { title: a.title, description: a.description } } }
      : { requestId: nonce, ...(a.module === 'hotels' ? { name: a.title } : { title: a.title }), description: a.description,
        ...(a.module === 'vehicles' && a.vehicleMode ? { vehicleMode: a.vehicleMode } : {}) } }) },
  submit: { label: 'Soumettre à validation', description: 'Soumettre une annonce existante à la modération. Les champs obligatoires seront contrôlés par le serveur. Ne rend pas active.',
    schema: listing, write: true, allowed: (role, a) => hasPermission(role, publish[a.module]), request: a => ({ method: 'POST', path: `/dashboard/${paths[a.module]}/${a.id}/submit` }) },
  admin_queue: { label: 'Annonces en attente', description: 'Lire les annonces en attente de modération. Aucune décision automatique.', schema: empty, context: 'refs', permission: 'access_admin', request: () => get('/admin/validation', { status: 'pending_review', limit: 10 }) },
};
// Without args, a tool restricted per module/type is usable if the role is allowed for at least one of them.
const PROBES = [...moduleSchema.options.map(module => ({ module })), ...(['hotel', 'rental', 'chauffeur', 'trip'] as const).map(type => ({ type }))];
export function canUseTool(role: UserRole, name: string, args?: any) {
  if (!Object.prototype.hasOwnProperty.call(ASSISTANT_TOOLS, name)) return false;
  const tool = ASSISTANT_TOOLS[name];
  if (tool.permission && !hasPermission(role, tool.permission)) return false;
  if (!tool.allowed) return true;
  if (args !== undefined) return tool.allowed(role, args);
  return PROBES.some(probe => { try { return tool.allowed!(role, probe); } catch { return false; } });
}
export function modelTools(role: UserRole) {
  return Object.entries(ASSISTANT_TOOLS).filter(([name]) => canUseTool(role, name)).map(([name, tool]) => ({ type: 'function', function: {
    name, description: tool.description, parameters: z.toJSONSchema(tool.schema),
  } }));
}
