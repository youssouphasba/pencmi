import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ASSISTANT_TOOLS, canUseTool, modelTools, ToolRequest } from './assistant.catalog';
import { ASSISTANT_DEFAULTS as copy } from './assistant.defaults';
import { modelView } from './assistant.summary';
import { helpFor, helpPrompt } from './assistant.help';

const turnSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) }).strict();
const inputSchema = z.object({ message: z.string().trim().min(1).max(2000), history: z.array(turnSchema).max(12).optional(), consent: z.literal(true) }).strict();
const confirmationSchema = z.object({ confirmation: z.string().max(15000), approved: z.literal(true) }).strict();

// Cost accounting in micro-dollars, at deepseek-flash peak cache-miss prices (pessimistic).
// Check https://api-docs.deepseek.com/quick_start/pricing before changing the model.
const INPUT_MICRO_PER_TOKEN = 0.3;
const OUTPUT_MICRO_PER_TOKEN = 1.2;
const MAX_BODY_BYTES = 160000;
const MAX_OUTPUT_TOKENS = 800;
const MAX_ROUNDS = 3; // model calls per user message
const MAX_CALLS_PER_ROUND = 3;
const DAILY_CALLS_PER_USER = 60;
const DAILY_CALLS_PER_VISITOR = 20;
const DAILY_CALLS_ALL_VISITORS = 300; // bounds the cost even if visitor addresses were spoofed
const VISITOR_FREE_QUESTIONS = 2; // per 24 hours; the next one invites to sign in or create an account
const VISITOR_MESSAGE_ACTION = 'assistant.visitor_message';
// Visitors (not signed in) may search, read a listing and ask about Péncmi; anything tied to an account asks them to sign in.
const VISITOR_TOOLS = ['faq', 'search', 'listing'];
const SIGN_IN_TOOL = { type: 'function', function: { name: 'sign_in',
  description: 'L’utilisateur n’est pas connecté. Appelle cet outil dès qu’il demande une action qui exige un compte (réserver, envoyer une demande, favoris, alertes, messages, suivi de ses demandes, publier). Indique en une phrase ce qui sera possible après connexion.',
  parameters: { type: 'object', properties: { reason: { type: 'string', maxLength: 200 } }, required: ['reason'], additionalProperties: false } } };

/** Who is talking to Guindi: a signed-in account or an anonymous visitor (keyed by a hashed IP). */
export type Visitor = { visitor: true; key: string; role: 'visitor'; id?: undefined; sessionId?: undefined };
export type Caller = AuthenticatedUser | Visitor;
const isVisitor = (caller: Caller): caller is Visitor => (caller as Visitor).visitor === true;
const RESERVE_ACTION = 'assistant.budget_reserved';

type Block =
  | { type: 'result'; tool: string; label: string; module?: string; result: unknown }
  | { type: 'proposal'; tool: string; label: string; args: unknown; confirmation: string; expiresAt: string }
  | { type: 'error'; label: string; message: string }
  | { type: 'login'; reason: string };
type ModelMessage = { role: string; content: string; tool_calls?: any[]; tool_call_id?: string; reasoning_content?: string };

class BudgetError extends HttpException {}

/** Spelled-out date in Dakar time: models miscount weekdays from a bare ISO timestamp. */
function today(now = new Date()) {
  const day = (offset: number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(now.getTime() + offset * 86400000));
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar' }).format(now);
  return `Aujourd'hui : ${day(0)} (${iso}). Demain : ${day(1)}. Les 7 jours suivants : ${[2, 3, 4, 5, 6, 7, 8].map(day).join(' ; ')}.`;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger('Assistant');
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  visitor(ip: string | undefined): Visitor {
    const key = createHash('sha256').update(`${this.config.get('JWT_SECRET') ?? ''}:visitor:${ip ?? 'unknown'}`).digest('hex').slice(0, 32);
    return { visitor: true, key, role: 'visitor' };
  }
  capabilities(user: Caller) {
    if (isVisitor(user)) {
      const help = helpFor('client' as any).filter(group => group.id === 'find');
      return { enabled: this.enabled(user), visitor: true, tools: VISITOR_TOOLS.map(name => ({ name, label: ASSISTANT_TOOLS[name].label, confirmationRequired: false })), help };
    }
    return { enabled: this.enabled(user), tools: Object.entries(ASSISTANT_TOOLS).filter(([name]) => canUseTool(user.role, name))
      .map(([name, tool]) => ({ name, label: tool.label, confirmationRequired: !!tool.write })), help: helpFor(user.role) };
  }
  private budgetCents() { return Math.min(10000, Number(this.config.get('ASSISTANT_BUDGET_CENTS') ?? 500)); }
  private enabled(user: Caller) {
    return this.config.get('ASSISTANT_ENABLED') === 'true' && !!this.config.get('DEEPSEEK_API_KEY') &&
      String(this.config.get('ASSISTANT_ROLES') ?? 'admin').split(',').map(v => v.trim()).includes(user.role);
  }
  private assertEnabled(user: Caller) {
    if (!this.enabled(user)) throw new ServiceUnavailableException(copy.unavailable);
  }

  /** Reserves a pessimistic estimate before calling the provider; settle() replaces it with the real usage. */
  private async reserve(user: Caller, payloadBytes: number) {
    const estimate = Math.ceil((payloadBytes / 2) * INPUT_MICRO_PER_TOKEN + MAX_OUTPUT_TOKENS * OUTPUT_MICRO_PER_TOKEN);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(784120519)`;
      // Legacy rows (before per-call accounting) stored a flat {cents}.
      const [{ spent }] = await tx.$queryRaw<{ spent: bigint | null }[]>`
        SELECT COALESCE(SUM(COALESCE((metadata->>'micro')::bigint, (metadata->>'cents')::bigint * 10000, 0)), 0) AS spent
        FROM "AuditLog" WHERE action = ${RESERVE_ACTION} AND module = 'system' AND "createdAt" >= ${monthStart}`;
      if (Number(spent ?? 0) + estimate > this.budgetCents() * 10000) {
        this.logger.warn(`Monthly budget reached: ${Number(spent ?? 0)} of ${this.budgetCents() * 10000} micro-dollars (ASSISTANT_BUDGET_CENTS).`);
        throw new BudgetError(copy.budget, 429);
      }
      const since = new Date(Date.now() - 86400000);
      if (isVisitor(user)) {
        const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "AuditLog" WHERE action = ${RESERVE_ACTION} AND metadata ? 'visitor' AND "createdAt" >= ${since}`;
        if (Number(n) >= DAILY_CALLS_ALL_VISITORS) throw new BudgetError(copy.visitorQuota, 429);
      }
      const recent = isVisitor(user)
        ? Number((await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "AuditLog" WHERE action = ${RESERVE_ACTION} AND metadata->>'visitor' = ${user.key} AND "createdAt" >= ${since}`)[0].n)
        : await tx.auditLog.count({ where: { action: RESERVE_ACTION, actorUserId: user.id, createdAt: { gte: since } } });
      if (recent >= (isVisitor(user) ? DAILY_CALLS_PER_VISITOR : DAILY_CALLS_PER_USER)) throw new BudgetError(isVisitor(user) ? copy.visitorQuota : copy.quota, 429);
      const row = await tx.auditLog.create({ data: { actorUserId: isVisitor(user) ? null : user.id, module: 'system', action: RESERVE_ACTION,
        metadata: { micro: estimate, estimated: true, ...(isVisitor(user) ? { visitor: user.key } : {}) } } });
      return row.id;
    });
  }
  private async settle(id: string, usage: any) {
    const input = Number(usage?.prompt_tokens), output = Number(usage?.completion_tokens);
    if (!Number.isFinite(input) || !Number.isFinite(output)) return; // keep the pessimistic estimate
    const micro = Math.ceil(input * INPUT_MICRO_PER_TOKEN + output * OUTPUT_MICRO_PER_TOKEN);
    const row = await this.prisma.auditLog.findUnique({ where: { id }, select: { metadata: true } }).catch(() => null);
    const visitor = (row?.metadata as any)?.visitor;
    await this.prisma.auditLog.update({ where: { id }, data: { metadata: { micro, inputTokens: input, outputTokens: output, ...(visitor ? { visitor } : {}) } } }).catch(() => undefined);
  }

  private signature(value: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update('pencmi-assistant-confirmation-v1:' + value).digest('hex');
  }
  private parse(name: string, args: unknown, user: Caller) {
    if (!Object.prototype.hasOwnProperty.call(ASSISTANT_TOOLS, name)) throw new BadRequestException(copy.invalid);
    const parsed = ASSISTANT_TOOLS[name].schema.safeParse(args);
    if (!parsed.success) throw new BadRequestException(copy.invalid);
    if (isVisitor(user) ? !VISITOR_TOOLS.includes(name) : !canUseTool(user.role, name, parsed.data)) throw new ForbiddenException('Votre compte ne permet pas cette action.');
    return parsed.data;
  }

  private async callModel(user: Caller, messages: ModelMessage[], final: boolean) {
    const tools = isVisitor(user) ? [...modelTools('client' as any).filter(tool => VISITOR_TOOLS.includes(tool.function.name)), SIGN_IN_TOOL] : modelTools(user.role);
    const payload = JSON.stringify({ model: this.config.get('ASSISTANT_MODEL') ?? 'deepseek-flash', messages,
      tools, ...(final ? { tool_choice: 'none' } : {}),
      max_tokens: MAX_OUTPUT_TOKENS, thinking: { type: 'disabled' }, stream: false });
    const bytes = Buffer.byteLength(payload);
    if (bytes > MAX_BODY_BYTES) throw new BadRequestException(copy.tooLong);
    const reservation = await this.reserve(user, bytes);
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${this.config.get('DEEPSEEK_API_KEY')}`, 'Content-Type': 'application/json' },
        body: payload, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error('provider');
      const data = await response.json() as any;
      await this.settle(reservation, data.usage);
      const message = data.choices?.[0]?.message;
      if (!message || data.choices[0].finish_reason === 'length') throw Error('provider');
      return message;
    } catch { throw new ServiceUnavailableException(copy.provider); }
  }

  private proposal(user: AuthenticatedUser, name: string, args: unknown): Block {
    const nonce = randomUUID(), exp = Date.now() + 300000;
    const encoded = Buffer.from(JSON.stringify({ name, args, nonce, userId: user.id, sessionId: user.sessionId, role: user.role, exp })).toString('base64url');
    return { type: 'proposal', tool: name, label: ASSISTANT_TOOLS[name].label, args, confirmation: encoded + '.' + this.signature(encoded), expiresAt: new Date(exp).toISOString() };
  }

  /** A signed-in user should not retype their contact details: fill the gaps from the account. */
  private async withAccountContact(user: AuthenticatedUser, args: any) {
    const details = { ...(args.details || {}) };
    if (!details.clientName || !details.clientEmail || !details.clientPhone) {
      const account = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true, email: true, phone: true } });
      details.clientName ||= [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim() || undefined;
      details.clientEmail ||= account?.email || undefined;
      details.clientPhone ||= account?.phone || undefined;
    }
    if (!details.clientName || details.clientName.length < 2) return null;
    return { ...args, details };
  }

  /** Runs one tool call; returns the text the model will see and adds what the user sees to blocks. */
  private async runTool(user: Caller, call: any, authorization: string, blocks: Block[], state: { proposed: boolean }) {
    if (isVisitor(user) && call?.function?.name === 'sign_in') {
      let reason = '';
      try { reason = String(JSON.parse(call.function.arguments || '{}').reason || '').slice(0, 200); } catch { /* keep default */ }
      if (!state.proposed) { state.proposed = true; blocks.push({ type: 'login', reason: reason || copy.signInReason }); }
      return JSON.stringify({ shownToUser: true, status: 'sign_in_requested', note: 'Un formulaire de connexion est affiché. La conversation reprendra après la connexion.' });
    }
    let args: any;
    try {
      args = this.parse(call?.function?.name, JSON.parse(call?.function?.arguments || '{}'), user);
    } catch (error) {
      return JSON.stringify({ error: error instanceof ForbiddenException ? 'Outil non autorisé pour ce compte.' : 'Arguments invalides pour cet outil.' });
    }
    const name = call.function.name, tool = ASSISTANT_TOOLS[name];
    if (name === 'create_request' && !isVisitor(user)) {
      const filled = await this.withAccountContact(user, args);
      if (!filled) return JSON.stringify({ error: 'Le compte n’a pas de nom : demande le nom à utiliser pour la demande.' });
      args = filled;
    }
    if (tool.write) {
      if (state.proposed) return JSON.stringify({ error: 'Une seule action à confirmer par réponse. Propose les autres ensuite.' });
      state.proposed = true;
      if (isVisitor(user)) return JSON.stringify({ error: 'Connexion requise : appelle sign_in.' });
      blocks.push(this.proposal(user, name, args));
      return JSON.stringify({ shownToUser: true, status: 'awaiting_user_confirmation', note: 'Rien n’est encore fait : l’utilisateur doit cliquer sur Confirmer.' });
    }
    try {
      const result = await this.execute(tool.request(args, randomUUID()), authorization);
      blocks.push({ type: 'result', tool: name, label: tool.label, module: args.module, result });
      return modelView(result, tool.context, args.module);
    } catch (error) {
      const message = error instanceof HttpException ? error.message : copy.failure;
      blocks.push({ type: 'error', label: tool.label, message });
      return JSON.stringify({ error: message });
    }
  }

  /** Visitors get a few free questions; past that, Guindi invites them to sign in (no model call, no cost). */
  private async visitorAllowance(visitor: Visitor) {
    const since = new Date(Date.now() - 86400000);
    const [{ n }] = await this.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "AuditLog" WHERE action = ${VISITOR_MESSAGE_ACTION} AND metadata->>'visitor' = ${visitor.key} AND "createdAt" >= ${since}`;
    if (Number(n) >= VISITOR_FREE_QUESTIONS) return false;
    await this.prisma.auditLog.create({ data: { actorUserId: null, module: 'system', action: VISITOR_MESSAGE_ACTION, metadata: { visitor: visitor.key } } });
    return true;
  }
  /** First name of a signed-in account, so Guindi can address the person naturally. */
  private async firstName(user: AuthenticatedUser) {
    const account = await this.prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true } }).catch(() => null);
    return account?.firstName?.trim().slice(0, 60) || '';
  }

  async chat(user: Caller, body: unknown, authorization: string) {
    this.assertEnabled(user);
    const input = inputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException('Écrivez votre message.');
    if (isVisitor(user) && !(await this.visitorAllowance(user)))
      return { kind: 'turn', text: copy.visitorLimitText, blocks: [{ type: 'login', reason: copy.visitorLimitReason }], memo: copy.visitorLimitText, limited: true };
    const name = isVisitor(user) ? '' : await this.firstName(user);
    const persona = isVisitor(user) ? copy.visitorPrompt
      : helpPrompt(user.role) + ` Rôle du compte : ${user.role}.` + (name ? `\nL'utilisateur s'appelle ${name}. Appelle-le par son prénom de temps en temps, naturellement (par exemple pour saluer ou confirmer), sans le répéter à chaque message.` : '');
    const messages: ModelMessage[] = [
      { role: 'system', content: copy.prompt + '\n' + persona + `\n${today()}` },
      ...(input.data.history || []).map(turn => ({ role: turn.role, content: turn.content })),
      { role: 'user', content: input.data.message },
    ];
    const blocks: Block[] = [];
    const notes: string[] = [];
    const state = { proposed: false };
    let text = '';
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let message: any;
      try {
        message = await this.callModel(user, messages, round === MAX_ROUNDS - 1);
      } catch (error) {
        if (!blocks.length) throw error;
        text = error instanceof BudgetError ? copy.budget : copy.partial;
        break;
      }
      const calls: any[] = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      text = String(message.content || '').trim();
      if (!calls.length) break;
      messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: calls,
        ...(message.reasoning_content ? { reasoning_content: message.reasoning_content } : {}) });
      for (const [index, call] of calls.entries()) {
        const content = index < MAX_CALLS_PER_ROUND ? await this.runTool(user, call, authorization, blocks, state)
          : JSON.stringify({ error: 'Trop d’outils dans une même réponse.' });
        messages.push({ role: 'tool', tool_call_id: String(call?.id ?? index), content });
        if (index < MAX_CALLS_PER_ROUND && call?.function?.name && ASSISTANT_TOOLS[call.function.name] && !content.startsWith('{"error"'))
          notes.push(`[${ASSISTANT_TOOLS[call.function.name].label}] ${content}`);
      }
      // A proposal or a sign-in request ends the turn: the user acts, the model is not called again.
      if (state.proposed) { text ||= blocks.some(block => block.type === 'login') ? copy.signInText : copy.proposed; break; }
    }
    text = (text || (blocks.length ? copy.shown : copy.clarify)).slice(0, 5000);
    // memo: what the browser sends back as this assistant turn, so the next message keeps context.
    const memo = [text, ...notes].join('\n').slice(0, 8000);
    return { kind: 'turn', text, blocks, memo };
  }

  async confirm(user: AuthenticatedUser, body: unknown, authorization: string) {
    this.assertEnabled(user);
    const input = confirmationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException(copy.invalid);
    const [encoded, signed, extra] = input.data.confirmation.split('.');
    if (extra || !/^[a-f0-9]{64}$/.test(signed || '') || !timingSafeEqual(Buffer.from(signed, 'hex'), Buffer.from(this.signature(encoded), 'hex')))
      throw new BadRequestException(copy.expired);
    let proposal: any;
    try { proposal = JSON.parse(Buffer.from(encoded, 'base64url').toString()); } catch { throw new BadRequestException(copy.expired); }
    if (proposal.userId !== user.id || proposal.sessionId !== user.sessionId || proposal.role !== user.role || proposal.exp < Date.now()) throw new ForbiddenException(copy.expired);
    const args = this.parse(proposal.name, proposal.args, user);
    const tool = ASSISTANT_TOOLS[proposal.name];
    if (!tool.write) throw new BadRequestException(copy.invalid);
    try {
      await this.prisma.auditLog.create({ data: { id: proposal.nonce, actorUserId: user.id, module: 'system', action: 'assistant.action_started', metadata: { tool: proposal.name } } });
    } catch (error) { if ((error as any).code === 'P2002') throw new ConflictException(copy.consumed); throw error; }
    try {
      const result = await this.execute(tool.request(args, proposal.nonce), authorization);
      await this.prisma.auditLog.update({ where: { id: proposal.nonce }, data: { action: 'assistant.action_succeeded' } });
      return { kind: 'result', tool: proposal.name, label: tool.label, result, completed: true,
        memo: `[Action confirmée par l’utilisateur et acceptée par le serveur : ${tool.label}]` };
    } catch (error) {
      await this.prisma.auditLog.update({ where: { id: proposal.nonce }, data: { action: 'assistant.action_check_required' } });
      throw error;
    }
  }

  private async execute(operation: ToolRequest, authorization: string) {
    // Only catalog routes reach the same API instance; its JWT, DTO and ownership guards run again.
    const prefix = String(this.config.get('API_PREFIX') ?? 'api/v1').replace(/^\/+|\/+$/g, '');
    const origin = `http://127.0.0.1:${this.config.get('PORT') ?? 4000}`;
    let response: Response;
    try {
      response = await fetch(`${origin}/${prefix}${operation.path}`, { method: operation.method, redirect: 'error',
        headers: { ...(authorization ? { Authorization: authorization } : {}), 'Content-Type': 'application/json' },
        body: operation.body ? JSON.stringify(operation.body) : undefined, signal: AbortSignal.timeout(20000) });
    } catch { throw new ServiceUnavailableException('Pas de réponse. Vérifiez dans votre espace avant de réessayer.'); }
    const data = await response.json().catch(() => null) as any;
    if (!response.ok) throw new HttpException(data?.error?.message || data?.message || 'Ça n’a pas marché. Réessayez.', response.status);
    return data;
  }
}
