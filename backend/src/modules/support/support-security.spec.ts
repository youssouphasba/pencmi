import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { SupportTicketStatus } from '@prisma/client';
import request = require('supertest');
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { USER_ROLES } from '../../common/constants/roles';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SUPPORT_TEXT_LIMITS, SUPPORT_WRITABLE_STATUSES } from './support.constants';

describe('Support ticket security', () => {
  let app: INestApplication;
  let service: SupportService;
  let tickets: { id: string; userId: string | null; status: SupportTicketStatus; messages: { id: string; body: string }[] }[];
  const prisma = {
    supportCategory: { findMany: jest.fn() },
    supportTicket: { create: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const tx = {
    supportTicket: { findFirst: jest.fn(), updateMany: jest.fn() },
    supportMessage: { create: jest.fn() },
  };
  const auth = { validateAccessToken: jest.fn() };
  const messagePath = '/support/tickets/ticket-a/messages';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [SupportService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    service = module.get(SupportService);
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    tickets = [
      { id: 'ticket-a', userId: 'user-a', status: 'open', messages: [{ id: 'old-message', body: 'Historique' }] },
      { id: 'ticket-b', userId: 'user-b', status: 'open', messages: [] },
      { id: 'legacy', userId: null, status: 'open', messages: [] },
    ];
    auth.validateAccessToken.mockImplementation(async (token) => {
      if (token === 'owner') return { id: 'user-a', role: 'client' };
      if (token === 'other') return { id: 'user-b', role: 'client' };
      if (USER_ROLES.includes(token)) return { id: 'user-b', role: token };
      throw new UnauthorizedException('Authentification requise.');
    });
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.supportTicket.findFirst.mockImplementation(async ({ where }) =>
      tickets.find((ticket) => ticket.id === where.id && ticket.userId === where.userId) ?? null);
    tx.supportTicket.updateMany.mockResolvedValue({ count: 1 });
    tx.supportMessage.create.mockImplementation(async ({ data }) => {
      const message = { id: 'new-message', ...data };
      tickets.find((ticket) => ticket.id === data.ticketId)?.messages.push(message);
      return message;
    });
    prisma.supportTicket.findMany.mockImplementation(async ({ where }) => tickets.filter((ticket) => ticket.userId === where.userId));
    prisma.supportTicket.create.mockImplementation(async ({ data }) => ({ id: 'new-ticket', ...data }));
    prisma.supportCategory.findMany.mockResolvedValue([]);
  });

  afterAll(async () => { await app.close(); });

  it.each(['open', 'pending'] as const)('allows the owner to append to a %s ticket', async (status) => {
    tickets[0].status = status;
    const response = await request(app.getHttpServer()).post(messagePath).set('Authorization', 'Bearer owner')
      .send({ body: '  Nouvelle réponse  ' }).expect(201);
    expect(response.body.senderUserId).toBe('user-a');
    expect(response.body.body).toBe('Nouvelle réponse');
    expect(tx.supportTicket.findFirst).toHaveBeenCalledWith({ where: { id: 'ticket-a', userId: 'user-a' }, select: { id: true, status: true } });
    expect(tx.supportTicket.updateMany).toHaveBeenCalledWith({
      where: { id: 'ticket-a', userId: 'user-a', status: { in: SUPPORT_WRITABLE_STATUSES } },
      data: { updatedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.supportTicket.findFirst.mock.invocationCallOrder[0]).toBeLessThan(tx.supportTicket.updateMany.mock.invocationCallOrder[0]);
    expect(tx.supportTicket.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.supportMessage.create.mock.invocationCallOrder[0]);
    expect(tickets[0].messages).toEqual([{ id: 'old-message', body: 'Historique' }, expect.objectContaining({ body: 'Nouvelle réponse' })]);
  });

  it.each(USER_ROLES)('denies access to another user’s ticket for role %s', async (role) => {
    await request(app.getHttpServer()).post(messagePath).set('Authorization', `Bearer ${role}`)
      .send({ body: 'Message' }).expect(404);
    expect(tx.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(tx.supportMessage.create).not.toHaveBeenCalled();
  });

  it.each(['get', 'post'] as const)('requires authentication for %s tickets', async (method) => {
    await request(app.getHttpServer())[method]('/support/tickets').send({ subject: 'Sujet', body: 'Message' }).expect(401);
    expect(prisma.supportTicket.findMany).not.toHaveBeenCalled();
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it('requires authentication to send a message', async () => {
    await request(app.getHttpServer()).post(messagePath).send({ body: 'Message' }).expect(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the same response for a missing ticket and a ticket owned by someone else', async () => {
    const other = await request(app.getHttpServer()).post(messagePath).set('Authorization', 'Bearer other').send({ body: 'Message' }).expect(404);
    const missing = await request(app.getHttpServer()).post('/support/tickets/missing/messages').set('Authorization', 'Bearer owner').send({ body: 'Message' }).expect(404);
    expect(other.body).toEqual(missing.body);
    expect(tx.supportMessage.create).not.toHaveBeenCalled();
  });

  it.each(['closed', 'resolved'] as const)('rejects messages to a %s ticket without altering history', async (status) => {
    tickets[0].status = status;
    await request(app.getHttpServer()).post(messagePath).set('Authorization', 'Bearer owner').send({ body: 'Message' }).expect(409);
    expect(tx.supportTicket.updateMany).not.toHaveBeenCalled();
    expect(tx.supportMessage.create).not.toHaveBeenCalled();
    const response = await request(app.getHttpServer()).get('/support/tickets').set('Authorization', 'Bearer owner').expect(200);
    expect(response.body[0].messages).toEqual([{ id: 'old-message', body: 'Historique' }]);
  });

  it('prevents insertion if ownership or status changes before the conditional write', async () => {
    tx.supportTicket.updateMany.mockResolvedValue({ count: 0 });
    await request(app.getHttpServer()).post(messagePath).set('Authorization', 'Bearer owner').send({ body: 'Message' }).expect(409);
    expect(tx.supportMessage.create).not.toHaveBeenCalled();
    expect(tickets[0].messages).toEqual([{ id: 'old-message', body: 'Historique' }]);
  });

  it.each(['senderUserId', 'userId', 'ticketId'])('rejects injected message field %s', async (field) => {
    await request(app.getHttpServer()).post(messagePath).set('Authorization', 'Bearer owner')
      .send({ body: 'Message', [field]: 'user-b' }).expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['', '   ', '\n\t', 'x'.repeat(SUPPORT_TEXT_LIMITS.body + 1), null, {}])('rejects invalid message body %#', async (body) => {
    await request(app.getHttpServer()).post(messagePath).set('Authorization', 'Bearer owner').send({ body }).expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['owner', 'other', 'admin'])('isolates ticket lists for %s despite query parameters', async (token) => {
    const response = await request(app.getHttpServer()).get('/support/tickets?userId=someone-else').set('Authorization', `Bearer ${token}`).expect(200);
    const userId = token === 'owner' ? 'user-a' : 'user-b';
    expect(response.body.every((ticket: { userId: string }) => ticket.userId === userId)).toBe(true);
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith({
      where: { userId }, include: { messages: { orderBy: { createdAt: 'asc' } } }, orderBy: { updatedAt: 'desc' },
    });
  });

  it('keeps unowned historical tickets inaccessible and unchanged', async () => {
    await request(app.getHttpServer()).post('/support/tickets/legacy/messages').set('Authorization', 'Bearer owner').send({ body: 'Message' }).expect(404);
    expect(tickets[2]).toEqual({ id: 'legacy', userId: null, status: 'open', messages: [] });
    expect(tx.supportMessage.create).not.toHaveBeenCalled();
  });

  it('preserves ticket creation with the authenticated author', async () => {
    await request(app.getHttpServer()).post('/support/tickets').set('Authorization', 'Bearer owner')
      .send({ subject: '  Demande  ', body: '  Message initial  ', categoryId: 'category-a' }).expect(201);
    expect(prisma.supportTicket.create).toHaveBeenCalledWith({
      data: { userId: 'user-a', categoryId: 'category-a', subject: 'Demande', messages: { create: { senderUserId: 'user-a', body: 'Message initial' } } },
      include: { messages: true },
    });
  });

  it.each(['userId', 'senderUserId', 'status'])('rejects injected ticket field %s', async (field) => {
    await request(app.getHttpServer()).post('/support/tickets').set('Authorization', 'Bearer owner')
      .send({ subject: 'Sujet', body: 'Message', [field]: 'injected' }).expect(400);
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it.each([
    { subject: '', body: 'Message' }, { subject: ' \n ', body: 'Message' },
    { subject: 'x'.repeat(SUPPORT_TEXT_LIMITS.subject + 1), body: 'Message' },
    { subject: 'Sujet', body: '' }, { subject: 'Sujet', body: '\t\n' },
    { subject: 'Sujet', body: 'x'.repeat(SUPPORT_TEXT_LIMITS.body + 1) },
  ])('rejects invalid ticket content %#', async (payload) => {
    await request(app.getHttpServer()).post('/support/tickets').set('Authorization', 'Bearer owner').send(payload).expect(400);
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
  });

  it('accepts subject and body at their length limits', async () => {
    await request(app.getHttpServer()).post('/support/tickets').set('Authorization', 'Bearer owner')
      .send({ subject: 'x'.repeat(SUPPORT_TEXT_LIMITS.subject), body: 'x'.repeat(SUPPORT_TEXT_LIMITS.body) }).expect(201);
  });

  it.each([undefined, '', '   '])('fails closed with a missing authenticated identity %#', async (userId) => {
    expect(() => service.findMine(userId as string)).toThrow(UnauthorizedException);
    expect(() => service.createTicket(userId as string, { subject: 'Sujet', body: 'Message' })).toThrow(UnauthorizedException);
    expect(() => service.createMessage('ticket-a', userId as string, { body: 'Message' })).toThrow(UnauthorizedException);
    expect(prisma.supportTicket.findMany).not.toHaveBeenCalled();
    expect(prisma.supportTicket.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps support categories public', async () => {
    await request(app.getHttpServer()).get('/support/categories').expect(200);
    expect(auth.validateAccessToken).not.toHaveBeenCalled();
  });
});
