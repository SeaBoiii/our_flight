import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getInvitation } from '../../../lib/invitation.server';
import { readSession, SESSION_COOKIE, sha256Hex } from '../../../lib/security.server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  const cookieStore = await cookies();
  const session = await readSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session || !token || (await sha256Hex(token)) !== session.inviteTokenHash) {
    return NextResponse.json({ error: 'session_required' }, { status: 401 });
  }

  const response = NextResponse.json({ invitation: getInvitation(session.cabinClass) });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

