/** Auth requests are tiny JSON documents; anything larger is refused before it is parsed. */
export const MAX_BODY_BYTES = 8 * 1024;

/**
 * Reads the body with a hard cap on the bytes actually received (a content-length header proves
 * nothing). Returns null when the body is larger than the cap.
 */
export async function readCappedBody(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return '';
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
