/**
 * Global API response shape and error handling.
 * All routes return { success, data? } or { success, error }.
 * Internal error details are never leaked for 5xx responses.
 */

export function jsonSuccess(data: unknown, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

export function jsonError(error: string, status = 500): Response {
  return Response.json({ success: false, error }, { status });
}

type ErrorWithStatus = Error & { status?: number };

export function withApi(
  handler: (req: Request) => Promise<unknown>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      const data = await handler(req);
      return jsonSuccess(data);
    } catch (e) {
      const err = e as ErrorWithStatus;
      const status = err?.status ?? 500;
      if (status >= 500) {
        console.error("[api] Internal error:", err);
        const message =
          process.env.NODE_ENV === "development"
            ? (err?.message ?? String(e))
            : "Internal server error";
        return jsonError(message, 500);
      }
      return jsonError(err?.message ?? String(e), status);
    }
  };
}

/** Throw with a specific HTTP status. Status < 500 messages are forwarded to the caller. */
export function throwStatus(message: string, status: number): never {
  const err = new Error(message) as ErrorWithStatus;
  err.status = status;
  throw err;
}

/** Check x-api-key header against INTERNAL_API_KEY env var. Throws 401 if invalid. */
export function requireApiKey(req: Request): void {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) {
    console.warn("[api] INTERNAL_API_KEY is not set — endpoint is unprotected");
    return;
  }
  const provided = req.headers.get("x-api-key");
  if (provided !== key) {
    throwStatus("Unauthorized", 401);
  }
}
