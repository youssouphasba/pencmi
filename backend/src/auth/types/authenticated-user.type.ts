import { UserRole } from '../../common/constants/roles';

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
  sessionId?: string;
};
