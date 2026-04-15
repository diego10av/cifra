// Client-side helpers to consume the api-errors envelope and render it.

export type UiError = { code: string; message: string; hint?: string };

export async function describeApiError(res: Response, fallback = 'Request failed'): Promise<UiError> {
  let code = `http_${res.status}`;
  let message = fallback;
  let hint: string | undefined;
  try {
    const body = await res.clone().json();
    const e = body?.error;
    if (e && typeof e === 'object') {
      if (typeof e.code === 'string') code = e.code;
      if (typeof e.message === 'string') message = e.message;
      if (typeof e.hint === 'string') hint = e.hint;
    } else if (typeof body?.error === 'string') {
      message = body.error;
    }
  } catch {
    // Not JSON — use fallback
  }
  return { code, message, hint };
}

export function formatUiError(e: UiError): string {
  return e.hint ? `${e.message} ${e.hint}` : e.message;
}
