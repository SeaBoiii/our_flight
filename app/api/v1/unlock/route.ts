import { getInvitation } from '../../../../lib/invitation.server';
import {
  isAllowedFrontendOrigin,
  hasJsonContentType,
  jsonResponse,
  preflightResponse,
  unauthorizedOriginResponse,
} from '../../../../lib/api.server';
import {
  classForToken,
  accessTokenIsConfigured,
  createAccessToken,
  validatePasscode,
} from '../../../../lib/security.server';
import type { UnlockResponse } from '../../../../lib/types';

export const runtime = 'edge';
const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return preflightResponse(request, METHODS);
}

export async function POST(request: Request) {
  if (!isAllowedFrontendOrigin(request)) return unauthorizedOriginResponse(request, METHODS);
  if (!accessTokenIsConfigured()) {
    return jsonResponse(request, { error: 'service_unavailable' }, 503, METHODS);
  }
  if (!hasJsonContentType(request)) {
    return jsonResponse(request, { error: 'unsupported_media_type' }, 415, METHODS);
  }

  try {
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > 2_048) {
      return jsonResponse(request, { error: 'request_too_large' }, 413, METHODS);
    }
    const rawBody = await request.text();
    if (rawBody.length > 2_048) {
      return jsonResponse(request, { error: 'request_too_large' }, 413, METHODS);
    }
    const body = JSON.parse(rawBody) as { token?: unknown; passcode?: unknown };
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const passcode = typeof body.passcode === 'string' ? body.passcode : '';
    const [cabinClass, passcodeIsValid] = await Promise.all([
      classForToken(token),
      validatePasscode(passcode),
    ]);

    if (!cabinClass || !passcodeIsValid) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return jsonResponse(request, { error: 'invalid_invitation' }, 401, METHODS);
    }

    const access = await createAccessToken(cabinClass);
    const response: UnlockResponse = {
      invitation: getInvitation(cabinClass),
      accessToken: access.token,
      expiresAt: access.expiresAt,
    };
    return jsonResponse(request, response, 200, METHODS);
  } catch {
    return jsonResponse(request, { error: 'invalid_request' }, 400, METHODS);
  }
}
