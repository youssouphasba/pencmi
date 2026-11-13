import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ASSISTANT_TOOLS, canUseTool, modelTools, ToolRequest } from './assistant.catalog';
import { ASSISTANT_DEFAULTS as copy } from './assistant.defaults';

const inputSchema = z.object({ message: z.string().trim().min(1).max(2000), history: z.array(z.string().max(2000)).max(3).optional(), consent: z.literal(true) }).strict();
const confirmationSchema = z.object({ confirmation: z.string().max(15000), approved: z.literal(true) }).strict();
// Reservation is deliberately pessimistic, retained even on network failure. Never reset on restart.
const RESERVATION_CENTS = 5;
const MAX_BODY_BYTES = 48000;
const MAX_OUTPUT_TOKENS = 800;
const RESERVE_ACTION = 'assistant.budget_reserved';

@Injectable()
export class AssistantService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  capabilities(user: AuthenticatedUser) {
    return { enabled: this.enabled(user), tools: Object.entries(ASSISTANT_TOOLS).filter(([name]) => canUseTool(user.role, name))
      .map(([name, tool]) => ({ name, label: tool.label, confirmationRequired: !!tool.write })), budgetCents: this.budget() };
  }
  private budget() { return Math.min(200, Number(this.config.get('ASSISTANT_BUDGET_CENTS') ?? 200)); }
  private enabled(user: AuthenticatedUser) {
    return this.config.get('ASSISTANT_ENABLED') === 'true' && !!this.config.get('DEEPSEEK_API_KEY') &&
      String(this.config.get('ASSISTANT_ROLES') ?? 'admin').split(',').map(v => v.trim()).includes(user.role);
  }
  private assertEnabled(user: AuthenticatedUser) {
    if (!this.enabled(user)) throw new ServiceUnavailableException(copy.unavailable);
  }
  private async reserve(user: AuthenticatedUser) {
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(784120519)`;
      const count = await tx.auditLog.count({ where: { action: RESERVE_ACTION, module: 'system' } });
      if ((count + 1) * RESERVATION_CENTS > this.budget()) throw new HttpException(copy.budget, 429);
      const recent = await tx.auditLog.count({ where: { action: RESERVE_ACTION, actorUserId: user.id, createdAt: { gte: new Date(Date.now() - 86400000) } } });
      if (recent >= 20) throw new HttpException('Votre quota quotidien de test est atteint.', 429);
      await tx.auditLog.create({ data: { actorUserId: user.id, module: 'system', action: RESERVE_ACTION, metadata: { cents: RESERVATION_CENTS } } });
    });
  }
  private signature(value: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET')).update('pencmi-assistant-confirmation-v1:' + value).digest('hex');
  }
  private parse(name: string, args: unknown, user: AuthenticatedUser) {
    if (!Object.prototype.hasOwnProperty.call(ASSISTANT_TOOLS, name)) throw new BadRequestException(copy.invalid);
    const parsed = ASSISTANT_TOOLS[name].schema.safeParse(args);
    if (!parsed.success) throw new BadRequestException(copy.invalid);
    if (!canUseTool(user.role, name, parsed.data)) throw new ForbiddenException('Cette action n’est pas autorisée pour votre compte.');
    return parsed.data;
  }
  async chat(user: AuthenticatedUser, body: unknown, authorization: string) {
    this.assertEnabled(user);
    const input = inputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException('Renseignez une demande et acceptez son traitement par DeepSeek.');
    const payload = JSON.stringify({ model: this.config.get('ASSISTANT_MODEL') ?? 'deepseek-flash',
      messages: [{ role: 'system', content: copy.prompt + `\nDate du Sénégal : ${new Date().toISOString()}. Rôle : ${user.role}.` },
        ...(input.data.history || []).map(content => ({ role: 'user', content })), { role: 'user', content: input.data.message }],
      tools: modelTools(user.role), max_tokens: MAX_OUTPUT_TOKENS, thinking: { type: 'disabled' }, stream: false });
    if (Buffer.byteLength(payload) > MAX_BODY_BYTES) throw new ServiceUnavailableException(copy.unavailable);
    await this.reserve(user);
    let message: any;
    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${this.config.get('DEEPSEEK_API_KEY')}`, 'Content-Type': 'application/json' },
        body: payload, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error('provider');
      const data = await response.json() as any;
      if (data.choices?.[0]?.finish_reason === 'length') throw Error('truncated');
      message = data.choices?.[0]?.message;
      if (!message) throw Error('provider');
    } catch { throw new ServiceUnavailableException(copy.provider); }
    if (!message.tool_calls?.length) return { kind: 'reply', text: String(message.content || 'Pouvez-vous préciser votre demande ?').slice(0, 5000) };
    if (message.tool_calls.length !== 1) throw new BadRequestException('Veuillez demander une seule opération à la fois.');
    const call = message.tool_calls[0]?.function;
    let raw: unknown;
    try { raw = JSON.parse(call.arguments); } catch { throw new BadRequestException(copy.invalid); }
    const args = this.parse(call.name, raw, user);
    const tool = ASSISTANT_TOOLS[call.name];
    const nonce = randomUUID();
    if (!tool.write) return { kind: 'result', label: tool.label, result: await this.execute(tool.request(args, nonce), authorization) };
    const encoded = Buffer.from(JSON.stringify({ name: call.name, args, nonce, userId: user.id, sessionId: user.sessionId, role: user.role, exp: Date.now() + 300000 })).toString('base64url');
    return { kind: 'proposal', label: tool.label, args, confirmation: encoded + '.' + this.signature(encoded), expiresAt: new Date(Date.now() + 300000).toISOString() };
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
      return { kind: 'result', label: tool.label, result, completed: true };
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
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: operation.body ? JSON.stringify(operation.body) : undefined, signal: AbortSignal.timeout(20000) });
    } catch { throw new ServiceUnavailableException('La réponse du service n’a pas été reçue. Vérifiez votre espace avant toute nouvelle tentative.'); }
    const data = await response.json().catch(() => null) as any;
    if (!response.ok) throw new HttpException(data?.error?.message || data?.message || 'Le service a refusé cette opération.', response.status);
    return data;
  }
}
