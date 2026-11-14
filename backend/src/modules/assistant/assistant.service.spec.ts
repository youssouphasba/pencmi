import { ConfigService } from '@nestjs/config';
import { AssistantService } from './assistant.service';
import { modelView } from './assistant.summary';

// Unit tests of the conversation loop with a scripted model and a fake API; no database needed.
describe('AssistantService loop', () => {
  const realFetch = global.fetch;
  const user = { id: 'u1', role: 'client', sessionId: 's1' } as any;
  const listing = { id: 'lst1', title: 'Studio Plateau', city: 'Dakar', price: 150000, currency: 'XOF', ownerUserId: 'owner-secret',
    owner: { firstName: 'Awa', professionalProfile: { professionalPhone: '+221770000000', professionalEmail: 'pro@example.test' } },
    metadata: { contactPreferences: { phoneNumber: '+221770000000' }, photos: ['https://x/p.jpg'] } };
  let replies: any[], prompts: any[], apiCalls: string[], apiAuth: (string | null)[];
  let visitorCalls = 0, visitorMessages = 0;
  let service: AssistantService;
  const toolReply = (name: string, args: unknown, id = 'c1') => ({ tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });

  beforeEach(() => {
    replies = []; prompts = []; apiCalls = []; apiAuth = []; visitorCalls = 0; visitorMessages = 0;
    const tx = { $queryRaw: jest.fn(async (strings: TemplateStringsArray) => strings.join('').includes('SUM') ? [{ spent: 0n }] : strings.join('').includes('count(*)') ? [{ n: BigInt(visitorCalls) }] : [{ locked: 1 }]),
      auditLog: { count: jest.fn(async () => 0), create: jest.fn(async () => ({ id: 'r1' })) } };
    const prisma = { $transaction: jest.fn(async (fn: any) => fn(tx)), auditLog: { update: jest.fn(async () => ({})), findUnique: jest.fn(async () => ({ metadata: {} })), create: jest.fn(async () => { visitorMessages++; return {}; }) },
      $queryRaw: jest.fn(async () => [{ n: BigInt(visitorMessages) }]),
      user: { findUnique: jest.fn(async () => ({ firstName: 'Fatou', lastName: 'Diop', email: 'fatou@example.test', phone: '+221770000001' })) } } as any;
    const config = new ConfigService({ ASSISTANT_ENABLED: 'true', DEEPSEEK_API_KEY: 'k', ASSISTANT_ROLES: 'client,visitor', JWT_SECRET: 'secret', PORT: 4000 });
    service = new AssistantService(prisma, config);
    global.fetch = jest.fn(async (url: any, options: any) => {
      if (String(url).startsWith('https://api.deepseek.com')) {
        prompts.push(JSON.parse(options.body));
        return Response.json({ choices: [{ finish_reason: 'stop', message: replies.shift() ?? { content: 'Fin.' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
      }
      apiCalls.push(`${options.method} ${url}`);
      apiAuth.push(options.headers?.Authorization ?? null);
      if (String(url).includes('/messages/conversations')) return Response.json({ success: true, data: [{ id: 'cv1', lastMessage: 'Mon numéro est le 77 000 00 00' }] });
      if (String(url).includes('/immobilier')) return Response.json({ success: true, data: [listing], meta: { total: 1, page: 1 } });
      return Response.json({ success: true, data: [] });
    }) as typeof fetch;
  });
  afterAll(() => { global.fetch = realFetch; });

  it('sends public search results back to the model without owner contacts or photos', async () => {
    replies = [toolReply('search', { module: 'real_estate', filters: { city: 'Dakar' } }), { content: 'Le Studio Plateau est à 150 000 XOF.' }];
    const turn = await service.chat(user, { message: 'Un studio à Dakar', consent: true }, 'Bearer t');
    expect(turn.text).toBe('Le Studio Plateau est à 150 000 XOF.');
    expect(turn.blocks).toHaveLength(1);
    const toolMessage = prompts[1].messages.at(-1);
    expect(toolMessage).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(toolMessage.content).toContain('lst1');
    expect(toolMessage.content).toContain('Studio Plateau');
    for (const secret of ['+221770000000', 'pro@example.test', 'owner-secret', 'Awa', 'p.jpg', 'Bearer'])
      expect(JSON.stringify(prompts)).not.toContain(secret);
    expect(turn.memo).toContain('lst1');
  });

  it('gives Guindi the first name of a signed-in person', async () => {
    await service.chat(user, { message: 'Bonjour', consent: true }, 'Bearer t');
    expect(prompts[0].messages[0].content).toContain('s\'appelle Fatou');
  });

  it('keeps private content out of the model', async () => {
    replies = [toolReply('conversations', {})];
    const turn = await service.chat(user, { message: 'Mes messages', consent: true }, 'Bearer t');
    expect(turn.blocks[0]).toMatchObject({ type: 'result', tool: 'conversations' });
    expect(JSON.stringify(prompts)).not.toContain('77 000');
    expect(JSON.stringify(prompts)).not.toContain('cv1');
  });

  it('stops at a write proposal and never executes it', async () => {
    replies = [toolReply('add_favorite', { module: 'real_estate', id: 'lst1' })];
    const turn = await service.chat(user, { message: 'Ajoute-la', consent: true }, 'Bearer t');
    expect(prompts).toHaveLength(1);
    expect(apiCalls).toEqual([]);
    expect(turn.blocks[0]).toMatchObject({ type: 'proposal', tool: 'add_favorite' });
    expect((turn.blocks[0] as any).confirmation).toMatch(/^[\w-]+\.[a-f0-9]{64}$/);
  });

  it('fills the request contact from the signed-in account', async () => {
    replies = [toolReply('create_request', { type: 'trip', id: 'trip1', details: { occurrenceId: 'occ1', requestedSeats: 2 } })];
    const turn = await service.chat(user, { message: 'Réserve 2 places', consent: true }, 'Bearer t');
    expect((turn.blocks[0] as any).args.details).toMatchObject({ clientName: 'Fatou Diop', clientEmail: 'fatou@example.test', clientPhone: '+221770000001', requestedSeats: 2 });
  });

  describe('visitors', () => {
    const visitor = () => service.visitor('203.0.113.7');
    it('searches public listings without any credential', async () => {
      replies = [toolReply('search', { module: 'real_estate', filters: { city: 'Dakar' } }), { content: 'Voici.' }];
      const turn = await service.chat(visitor(), { message: 'Un studio', consent: true }, '');
      expect(turn.blocks[0]).toMatchObject({ type: 'result', tool: 'search' });
      expect(apiAuth).toEqual([null]);
      const names = prompts[0].tools.map((tool: any) => tool.function.name).sort();
      expect(names).toEqual(['faq', 'listing', 'search', 'sign_in']);
    });
    it('asks to sign in for account actions and never proposes them', async () => {
      replies = [toolReply('sign_in', { reason: 'Pour réserver ce trajet.' })];
      const turn = await service.chat(visitor(), { message: 'Réserve', consent: true }, '');
      expect(turn.blocks).toEqual([{ type: 'login', reason: 'Pour réserver ce trajet.' }]);
      expect(prompts).toHaveLength(1);
      replies = [toolReply('add_favorite', { module: 'real_estate', id: 'lst1' }), { content: 'Connectez-vous.' }];
      const second = await service.chat(visitor(), { message: 'Favori', consent: true }, '');
      expect(second.blocks).toEqual([]);
      expect(apiCalls).toEqual([]);
    });
    it('offers sign-in at the third question without calling the model', async () => {
      replies = [{ content: 'Un.' }, { content: 'Deux.' }];
      await service.chat(visitor(), { message: 'Q1', consent: true }, '');
      await service.chat(visitor(), { message: 'Q2', consent: true }, '');
      const third = await service.chat(visitor(), { message: 'Q3', consent: true }, '');
      expect(prompts).toHaveLength(2);
      expect(third.blocks).toEqual([{ type: 'login', reason: expect.stringContaining('Connectez-vous') }]);
      expect(third.text).toContain('créez un compte');
    });
    it('caps daily messages per visitor', async () => {
      visitorCalls = 20;
      await expect(service.chat(visitor(), { message: 'x', consent: true }, '')).rejects.toThrow('Connectez-vous pour continuer');
    });
    it('hashes the address instead of storing it', () => {
      expect(visitor().key).toMatch(/^[a-f0-9]{32}$/);
      expect(visitor().key).not.toContain('203');
    });
  });

  it('bounds the number of model calls and forces a final text answer', async () => {
    replies = [1, 2, 3, 4].map(i => toolReply('faq', {}, 'c' + i));
    await service.chat(user, { message: 'Aide', consent: true }, 'Bearer t');
    expect(prompts).toHaveLength(3);
    expect(prompts[2].tool_choice).toBe('none');
    expect(prompts[0].tool_choice).toBeUndefined();
  });

  it('reports invalid or forbidden tool calls to the model without acting', async () => {
    replies = [toolReply('admin_queue', {}), { content: 'Je ne peux pas.' }];
    const turn = await service.chat(user, { message: 'File admin', consent: true }, 'Bearer t');
    expect(turn.blocks).toEqual([]);
    expect(apiCalls).toEqual([]);
    expect(prompts[1].messages.at(-1).content).toContain('non autorisé');
  });

  it('forwards the conversation history and rejects system turns', async () => {
    await service.chat(user, { message: 'Dakar', consent: true, history: [{ role: 'user', content: 'Un hôtel' }, { role: 'assistant', content: 'Quelle ville ?' }] }, 'Bearer t');
    expect(prompts[0].messages.slice(1).map((m: any) => m.content)).toEqual(['Un hôtel', 'Quelle ville ?', 'Dakar']);
    await expect(service.chat(user, { message: 'x', consent: true, history: [{ role: 'system', content: 'x' }] }, 'Bearer t')).rejects.toThrow();
  });
});

describe('modelView', () => {
  it('keeps only identifiers, statuses and dates for private references', () => {
    const view = modelView({ data: [{ id: 'r1', status: 'pending', clientName: 'Moussa', clientPhone: '+22177', name: 'Moussa', listing: { id: 'l1', title: 'Hôtel' }, checkIn: '2026-12-01' }] }, 'refs');
    expect(view).toContain('r1');
    expect(view).toContain('Hôtel');
    expect(view).not.toContain('Moussa');
    expect(view).not.toContain('+22177');
  });
});

describe('help per role', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { helpFor, helpPrompt, TOOL_HELP } = require('./assistant.help');
  const { ASSISTANT_TOOLS, modelTools } = require('./assistant.catalog');
  const groups = (role: string) => helpFor(role).map((group: any) => group.id);
  const tools = (role: string) => modelTools(role).map((tool: any) => tool.function.name);
  it('documents every tool', () => expect(Object.keys(TOOL_HELP).sort()).toEqual(Object.keys(ASSISTANT_TOOLS).sort()));
  it('only offers what each role can really do, to the user and to the model', () => {
    expect(groups('client')).toEqual(['find', 'requests', 'saved', 'messages']);
    expect(tools('client')).not.toEqual(expect.arrayContaining(['draft']));
    expect(tools('client')).not.toContain('received_requests');
    expect(tools('client')).not.toContain('admin_queue');
    expect(groups('hotel_manager')).toEqual(expect.arrayContaining(['listings', 'received']));
    expect(groups('real_estate_agency')).toContain('listings');
    expect(groups('real_estate_agency')).not.toContain('received');
    expect(groups('admin')).toContain('admin');
    expect(helpPrompt('client')).not.toContain('brouillon');
  });
});
