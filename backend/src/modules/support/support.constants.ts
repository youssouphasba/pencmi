import { SupportTicketStatus } from '@prisma/client';

export const SUPPORT_TEXT_LIMITS = { subject: 200, body: 10000 } as const;

export const SUPPORT_WRITABLE_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.open,
  SupportTicketStatus.pending,
];
