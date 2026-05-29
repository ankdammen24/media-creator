export const PUBLIC_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
} as const;

export const V1_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

export function jsonResponse(
  data: unknown,
  init: { status?: number; cors?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.cors ?? PUBLIC_CORS),
    },
  });
}

export function errorResponse(
  message: string,
  status: number,
  cors: Record<string, string> = PUBLIC_CORS,
): Response {
  return jsonResponse({ error: message }, { status, cors });
}

export function optionsResponse(cors: Record<string, string>): Response {
  return new Response(null, { status: 204, headers: cors });
}
