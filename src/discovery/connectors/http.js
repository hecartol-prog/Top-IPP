/**
 * HTTP fetch with timeout / status / encoding resilience for connectors.
 * Services never embed source URLs — callers pass registry URL.
 */

/**
 * @typedef {Object} FetchResult
 * @property {boolean} ok
 * @property {number} [status]
 * @property {string} [body]
 * @property {string} [contentType]
 * @property {string} [finalUrl]
 * @property {string} [error]
 * @property {string} [errorCode]
 */

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, headers?: Record<string, string>, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<FetchResult>}
 */
export async function fetchText(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;

  if (!url || typeof url !== 'string') {
    return { ok: false, error: 'missing_url', errorCode: 'invalid_url' };
  }

  // file:// and fixture offline — not fetched over network
  if (url.startsWith('file://') || url.includes('.invalid')) {
    return {
      ok: false,
      error: 'offline_or_placeholder_url',
      errorCode: 'requires_payload',
      finalUrl: url,
    };
  }

  if (typeof fetchImpl !== 'function') {
    return { ok: false, error: 'fetch_unavailable', errorCode: 'no_fetch' };
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: '*/*',
        ...(opts.headers || {}),
      },
      signal: controller?.signal,
    });

    const status = res.status;
    if (status === 404) {
      return { ok: false, status, error: 'not_found', errorCode: 'http_404', finalUrl: res.url || url };
    }
    if (status >= 500) {
      return { ok: false, status, error: `server_error_${status}`, errorCode: 'http_5xx', finalUrl: res.url || url };
    }
    if (!res.ok) {
      return { ok: false, status, error: `http_${status}`, errorCode: 'http_error', finalUrl: res.url || url };
    }

    let body;
    try {
      // Prefer text; handles encoding via platform decoder
      body = await res.text();
    } catch (err) {
      return {
        ok: false,
        status,
        error: `encoding_error:${err?.message || err}`,
        errorCode: 'encoding',
        finalUrl: res.url || url,
      };
    }

    const contentType = res.headers?.get?.('content-type') || 'text/plain';
    return {
      ok: true,
      status,
      body,
      contentType,
      finalUrl: res.url || url,
    };
  } catch (err) {
    const msg = String(err?.message || err);
    const aborted = err?.name === 'AbortError' || /aborted|timeout/i.test(msg);
    return {
      ok: false,
      error: msg,
      errorCode: aborted ? 'timeout' : 'network',
      finalUrl: url,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
