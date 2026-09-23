import axios from 'axios';

export const TOKEN_KEY = 'dna.token';
export const USER_KEY = 'dna.user';

/** Normalised error surfaced to every screen so states stay consistent. */
export class ApiError extends Error {
  constructor({ message, status, code, retryable, keyAttached }) {
    super(message);
    this.name = 'ApiError';
    this.status = status ?? null;
    this.code = code ?? null;
    this.retryable = retryable ?? false;
    /* Only ever set on Secret Scanner responses: whether the server-side proxy
       attached the dashboard key ('yes' | 'no'), read from the
       `X-Scanner-Key-Attached` header the proxy adds. Never the key itself. */
    this.keyAttached = keyAttached ?? null;
  }
}

function describe(error) {
  if (axios.isCancel?.(error) || error?.code === 'ERR_CANCELED') {
    return new ApiError({ message: 'Request cancelled', code: 'CANCELLED' });
  }

  const status = error?.response?.status ?? null;
  const payload = error?.response?.data;
  const serverMessage =
    (typeof payload === 'object' && (payload?.message || payload?.error)) || null;

  if (!error?.response) {
    return new ApiError({
      message:
        error?.code === 'ECONNABORTED'
          ? 'The request timed out before the service responded.'
          : 'Could not reach the service. Check that the API is running and reachable.',
      code: error?.code || 'NETWORK',
      retryable: true,
    });
  }

  const byStatus = {
    400: serverMessage || 'The request was rejected as invalid.',
    401: serverMessage || 'Your session is no longer valid. Sign in again to continue.',
    403: serverMessage || 'You do not have access to this resource.',
    404: serverMessage || 'That resource no longer exists.',
    500: serverMessage || 'The service failed while handling this request.',
  };

  return new ApiError({
    message: byStatus[status] || serverMessage || `Request failed with status ${status}.`,
    status,
    code: payload?.error || null,
    retryable: status >= 500 || status === 429,
    keyAttached: error?.response?.headers?.['x-scanner-key-attached'] ?? null,
  });
}

/** Shared response/error plumbing for both upstreams. */
export function attachInterceptors(instance, { onUnauthorized } = {}) {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const normalised = describe(error);
      if (normalised.status === 401) onUnauthorized?.(normalised);
      return Promise.reject(normalised);
    },
  );
  return instance;
}

/**
 * The Go API wraps everything in { success, message, data, total_count, ... }.
 * Unwrap once, here, so no screen has to think about the envelope.
 */
export function unwrap(response) {
  const body = response?.data ?? {};
  if (body.success === false) {
    throw new ApiError({
      message: body.message || body.error || 'The service reported a failure.',
      status: response?.status ?? null,
      retryable: true,
    });
  }
  return body;
}

export function unwrapList(response) {
  const body = unwrap(response);
  const rows = Array.isArray(body.data) ? body.data : [];
  return {
    rows,
    total: Number.isFinite(body.total_count) ? body.total_count : rows.length,
    page: body.page ?? 1,
    pageSize: body.page_size ?? rows.length,
  };
}
