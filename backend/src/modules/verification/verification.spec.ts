import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { VerificationService } from './verification.service';

const upload = (fieldname: string) => ({ fieldname, buffer: Buffer.from('x'), mimetype: 'image/png', originalname: 'a.png', size: 1 });

function setup(user: any = { role: 'real_estate_agency', professionalVerified: false }, open: any = null) {
  const tx: any = {
    $queryRaw: jest.fn(),
    verificationRequest: {
      findFirst: jest.fn(async () => open),
      create: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findUnique: jest.fn(async () => ({ id: 'r' })),
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'r',
        userId: 'u',
        documents: [{ fileId: 'f1' }, { fileId: 'f2' }],
        user: { id: 'u', status: 'active', deletedAt: null },
      })),
    },
    verificationDocument: { create: jest.fn() },
    auditLog: { create: jest.fn() },
    notification: { create: jest.fn(async () => ({ id: 'n' })) },
    user: { update: jest.fn(), updateMany: jest.fn(async () => ({ count: 1 })) },
    professionalProfile: { updateMany: jest.fn() },
  };
  const prisma: any = {
    user: { findUniqueOrThrow: jest.fn(async () => user) },
    $transaction: jest.fn(async (run: any) => run(tx)),
  };
  const files: any = {
    prepareVerificationDocument: jest.fn(async (file: any) => ({ ...file, mimetype: 'image/png' })),
    storeVerificationDocument: jest.fn(),
    purgeVerificationDocuments: jest.fn(async () => 0),
  };
  return { tx, prisma, files, service: new VerificationService(prisma, files) };
}

describe('verification submission', () => {
  it('stores every required document privately in one pending request', async () => {
    const { tx, files, service } = setup();
    await expect(service.submit('u', [upload('identity'), upload('business_registration')])).resolves.toMatchObject({ status: 'pending' });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.verificationRequest.create.mock.calls[0][0].data).toMatchObject({ userId: 'u', status: 'pending' });
    expect(files.storeVerificationDocument).toHaveBeenCalledTimes(2);
    expect(tx.verificationDocument.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'verification.submitted' });
  });

  it('refuses missing, unknown or duplicated documents before storing anything', async () => {
    const { files, service } = setup();
    await expect(service.submit('u', [upload('identity')])).rejects.toThrow('Registre de commerce');
    await expect(service.submit('u', [upload('identity'), upload('business_registration'), upload('passport')])).rejects.toThrow(BadRequestException);
    await expect(service.submit('u', [upload('identity'), upload('identity'), upload('business_registration')])).rejects.toThrow(BadRequestException);
    expect(files.prepareVerificationDocument).not.toHaveBeenCalled();
  });

  it('is reserved to professionals, once, and not while a request is open', async () => {
    await expect(setup({ role: 'client', professionalVerified: false }).service.submit('u', [upload('identity')])).rejects.toThrow(ForbiddenException);
    await expect(setup({ role: 'chauffeur', professionalVerified: true }).service.submit('u', [upload('identity')])).rejects.toThrow(ConflictException);
    const busy = setup({ role: 'advertiser_individual', professionalVerified: false }, { id: 'old' });
    await expect(busy.service.submit('u', [upload('identity')])).rejects.toThrow(ConflictException);
  });

  it('removes the binaries already written when the transaction fails', async () => {
    const { tx, files, service } = setup({ role: 'advertiser_individual', professionalVerified: false });
    tx.verificationDocument.create.mockRejectedValueOnce(new Error('db'));
    await expect(service.submit('u', [upload('identity')])).rejects.toThrow('db');
    expect(files.purgeVerificationDocuments).toHaveBeenCalledWith([expect.any(String)]);
  });
});

describe('verification decision', () => {
  it('grants the badge, notifies, audits and deletes the documents', async () => {
    const { tx, files, service } = setup();
    await expect(service.decide('admin', 'r', { decision: 'accepted' })).resolves.toEqual({ id: 'r', status: 'accepted', documentsDeleted: 2 });
    expect(tx.verificationRequest.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'r', status: 'pending' } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u' }, data: { professionalVerified: true } });
    expect(tx.professionalProfile.updateMany).toHaveBeenCalledWith({ where: { userId: 'u' }, data: { verified: true } });
    expect(tx.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u', type: 'verification_accepted' });
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'verification.accepted' });
    expect(files.purgeVerificationDocuments).toHaveBeenCalledWith(['f1', 'f2']);
  });

  it('needs a reason to refuse and leaves the badge untouched', async () => {
    const { tx, service } = setup();
    await expect(service.decide('admin', 'r', { decision: 'refused' })).rejects.toThrow(BadRequestException);
    await service.decide('admin', 'r', { decision: 'requires_more_info', reason: 'Pièce illisible' });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.notification.create.mock.calls[0][0].data.message).toContain('Motif : Pièce illisible');
  });

  it('refuses a second decision on the same request', async () => {
    const { tx, files, service } = setup();
    tx.verificationRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.decide('admin', 'r', { decision: 'accepted' })).rejects.toThrow(ConflictException);
    expect(files.purgeVerificationDocuments).not.toHaveBeenCalled();
  });

  it('withdraws a badge with a reason', async () => {
    const { tx, service } = setup();
    await expect(service.revoke('admin', 'u', { reason: 'Activité arrêtée' })).resolves.toEqual({ userId: 'u', verified: false });
    expect(tx.professionalProfile.updateMany).toHaveBeenCalledWith({ where: { userId: 'u' }, data: { verified: false } });
    tx.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.revoke('admin', 'u', { reason: 'x' })).rejects.toThrow(ConflictException);
  });
});
