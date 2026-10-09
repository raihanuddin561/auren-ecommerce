import type { HttpRequest, HttpResponse, HttpTransport } from './types';

type Handler = (request: HttpRequest) => HttpResponse | Promise<HttpResponse>;

/**
 * A scripted transport for tests and local sandbox runs: routes are matched by method and URL
 * suffix, and every request is recorded. Nothing here talks to a courier.
 */
export function createFakeTransport(routes: Record<string, Handler | HttpResponse>) {
  const requests: HttpRequest[] = [];
  const transport: HttpTransport = {
    async send(request) {
      requests.push(request);
      const key = Object.keys(routes).find((candidate) => {
        const [method, suffix] = candidate.split(' ');
        return method === request.method && request.url.endsWith(suffix ?? '');
      });
      if (!key)
        return {
          status: 404,
          json: { message: `no fake route for ${request.method} ${request.url}` },
        };
      const route = routes[key]!;
      return typeof route === 'function' ? route(request) : route;
    },
  };
  return { transport, requests };
}
