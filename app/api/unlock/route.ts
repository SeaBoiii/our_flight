import { NextResponse } from 'next/server';
import { getInvitation } from '../../../lib/invitation.server';
import {
  classForToken,
  createSession,
  isAllowedOrigin,
  SESSION_COOKIE,
  sessionMaxAge,
  validatePasscode,
} from '../../../lib/security.server';

export const runtime = 'edge';

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 403 });
  }

  try {
    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (declaredLength > 2_048) {
      return NextResponse.json({ error: 'request_too_large' }, { status: 413 });
    }
    const rawBody = await request.text();
    if (rawBody.length > 2_048) {
      return NextResponse.json({ error: 'request_too_large' }, { status: 413 });
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
      return NextResponse.json({ error: 'invalid_invitation' }, { status: 401 });
    }

    const response = NextResponse.json({ invitation: getInvitation(cabinClass) });
    response.cookies.set(SESSION_COOKIE, await createSession(cabinClass, token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: sessionMaxAge(),
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}
