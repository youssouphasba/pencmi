import { Logger, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter, describeServerError } from './all-exceptions.filter';
import { HealthController } from '../../modules/health/health.controller';

const host = (headers: Record<string, string> = {}) => {
  const response: any = { headersSent: false, setHeader: jest.fn(), status: jest.fn(() => response), json: jest.fn() };
  const request = { headers, method: 'POST', path: '/api/v1/immobilier/x/visit-requests' };
  return { response, host: { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) } as any };
};

describe('server error logging', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs a 500 with its request id, without the error message', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { response, host: h } = host({ 'x-railway-request-id': 'rw-123' });
    new AllExceptionsFilter().catch(Object.assign(new Error('client@example.test'), { code: 'P2028' }), h);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'rw-123');
    expect(response.json.mock.calls[0][0].error).toMatchObject({ code: 'INTERNAL_ERROR', requestId: 'rw-123' });
    const line = log.mock.calls[0][0] as any;
    expect(line).toMatchObject({ requestId: 'rw-123', method: 'POST', status: 500, error: { name: 'Error', code: 'P2028' } });
    expect(JSON.stringify(line)).not.toContain('client@example.test');
  });

  it('does not log client errors and generates an id when none is valid', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { response, host: h } = host({ 'x-request-id': 'bad id\nforged' });
    new AllExceptionsFilter().catch(new NotFoundException(), h);
    expect(log).not.toHaveBeenCalled();
    expect(response.json.mock.calls[0][0].error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps only call sites from a stack', () => {
    const error = new TypeError('secret');
    expect(describeServerError(error).frames.every((frame) => frame.startsWith('at '))).toBe(true);
    expect(JSON.stringify(describeServerError(error))).not.toContain('secret');
  });
});

describe('readiness', () => {
  it('reports the database state', async () => {
    const ok = new HealthController({ $queryRaw: jest.fn(async () => [1]) } as any);
    await expect(ok.getReady()).resolves.toMatchObject({ status: 'ready', database: 'ok' });
    const down = new HealthController({ $queryRaw: jest.fn(async () => { throw new Error('down'); }) } as any);
    await expect(down.getReady()).rejects.toMatchObject({ status: 503 });
  });
});
