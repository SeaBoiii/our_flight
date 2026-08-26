import {
  isAllowedFrontendOrigin,
  jsonResponse,
  preflightResponse,
  unauthorizedOriginResponse,
} from '../../../../lib/api.server';
import { getInvitation } from '../../../../lib/invitation.server';
import { accessTokenIsConfigured, authenticateRequest } from '../../../../lib/security.server';
import type { InvitationResponse } from '../../../../lib/types';

export const runtime = 'edge';
const METHODS = 'GET, OPTIONS';

export function OPTIONS(request: Request) {
  return preflightResponse(request, METHODS);
}

export async function GET(request: Request) {
  if (!isAllowedFrontendOrigin(request)) return unauthorizedOriginResponse(request, METHODS);
  if (!accessTokenIsConfigured()) {
    return jsonResponse(request, { error: 'service_unavailable' }, 503, METHODS);
  }
  const session = await authenticateRequest(request);
  if (!session) return jsonResponse(request, { error: 'session_required' }, 401, METHODS);

  const response: InvitationResponse = {
    invitation: getInvitation(session.cabinClass),
    expiresAt: new Date(session.exp * 1000).toISOString(),
  };
  return jsonResponse(request, response, 200, METHODS);
}
