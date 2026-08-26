const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function configuredOrigin(): string | null {
  const value = process.env.FRONTEND_ORIGIN;
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== normalized) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isAllowedFrontendOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const allowed = configuredOrigin();
  if (!origin || !allowed || origin === 'null') return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && origin === allowed;
  } catch {
    return false;
  }
}

export function corsHeaders(request: Request, methods: string): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  });
  if (isAllowedFrontendOrigin(request)) {
    headers.set('Access-Control-Allow-Origin', new URL(request.headers.get('origin')!).origin);
  }
  return headers;
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status: number,
  methods: string,
): Response {
  const headers = corsHeaders(request, methods);
  for (const [key, value] of Object.entries(JSON_HEADERS)) headers.set(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}

export function preflightResponse(request: Request, methods: string): Response {
  if (!isAllowedFrontendOrigin(request)) {
    return new Response(null, { status: 403, headers: corsHeaders(request, methods) });
  }
  return new Response(null, { status: 204, headers: corsHeaders(request, methods) });
}

export function unauthorizedOriginResponse(request: Request, methods: string): Response {
  return jsonResponse(request, { error: 'invalid_request' }, 403, methods);
}

export function hasJsonContentType(request: Request): boolean {
  return /^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '');
}
