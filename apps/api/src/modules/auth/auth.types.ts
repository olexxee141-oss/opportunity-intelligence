import type { WorkspaceRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AuthenticatedRequestUser extends AuthenticatedUser {
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
}
