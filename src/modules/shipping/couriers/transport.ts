import 'server-only';
import type { HttpRequest, HttpResponse, HttpTransport } from './types';

/** The real transport: fetch with a timeout. Tests pass a fake instead (see fake-transport.ts). */
export const fetchTransport: HttpTransport = {
  async send(request: HttpRequest): Promise<HttpResponse> {
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        ...(request.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...request.headers,
      },
      ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // A non JSON body (a gateway error page) is reported through the status code.
    }
    return { status: response.status, json };
  },
};
