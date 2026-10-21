// Thin fetch wrapper: JSON in, readable errors out.
const memo = new Map();

export class ApiError extends Error {
  constructor(status, code, detail) {
    super(detail || `Request failed (${status})`);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { cache = true, signal } = {}) {
  if (cache && memo.has(path)) return memo.get(path);
  const request = fetch(`/api${path}`, { signal }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, body.error, body.detail);
    return body;
  });
  if (cache) {
    memo.set(path, request);
    // Failed requests should be retryable
    request.catch(() => memo.delete(path));
  }
  return request;
}
