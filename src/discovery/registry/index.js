/**
 * Configurable Source Registry — URLs and refresh policy live here, not in services.
 */

import { PRODUCTION_SOURCES } from '../config/sources.js';
import { CONNECTOR_TYPES } from './types.js';

/**
 * @typedef {import('./types.js').SourceRegistryEntry} SourceRegistryEntry
 */

/**
 * @param {Partial<SourceRegistryEntry> & { id: string, name: string, type: string, url: string }} raw
 * @returns {SourceRegistryEntry}
 */
export function normalizeSourceEntry(raw) {
  if (!raw?.id || !raw?.name || !raw?.type || !raw?.url) {
    throw new Error('Source requires id, name, type, url');
  }
  if (!CONNECTOR_TYPES.includes(raw.type)) {
    throw new Error(`Unsupported connector type: ${raw.type}`);
  }
  return {
    id: String(raw.id),
    name: String(raw.name),
    type: /** @type {any} */ (raw.type),
    country: raw.country || 'GLOBAL',
    industry: raw.industry || '',
    vertical_pack: raw.vertical_pack || '',
    url: String(raw.url),
    language: raw.language || 'en',
    refresh_interval: raw.refresh_interval || '24h',
    enabled: raw.enabled !== false,
    priority: typeof raw.priority === 'number' ? raw.priority : 100,
    last_success: raw.last_success ?? null,
    last_error: raw.last_error ?? null,
    supported_countries: raw.supported_countries || [raw.country || 'GLOBAL'],
    supported_languages: raw.supported_languages || [raw.language || 'en'],
    supported_vertical_packs: raw.supported_vertical_packs || (raw.vertical_pack ? [raw.vertical_pack] : []),
    parser: raw.parser || raw.type,
    normalizer: raw.normalizer || 'default',
    source_weight: typeof raw.source_weight === 'number' ? raw.source_weight : 0.65,
    source_type: raw.source_type || raw.type,
  };
}

export class SourceRegistry {
  /**
   * @param {SourceRegistryEntry[]} [seed]
   */
  constructor(seed = PRODUCTION_SOURCES) {
    /** @type {Map<string, SourceRegistryEntry>} */
    this._sources = new Map();
    for (const s of seed) {
      const n = normalizeSourceEntry(s);
      this._sources.set(n.id, n);
    }
  }

  /**
   * @param {Partial<SourceRegistryEntry> & { id: string, name: string, type: string, url: string }} entry
   */
  register(entry) {
    const n = normalizeSourceEntry(entry);
    this._sources.set(n.id, n);
    return n;
  }

  /**
   * @param {string} id
   * @param {Partial<SourceRegistryEntry>} patch
   */
  update(id, patch) {
    const cur = this._sources.get(id);
    if (!cur) throw new Error(`Unknown source: ${id}`);
    const next = normalizeSourceEntry({ ...cur, ...patch, id });
    this._sources.set(id, next);
    return next;
  }

  /**
   * @param {string} id
   * @param {string|null} error
   */
  markError(id, error) {
    return this.update(id, { last_error: error, last_success: this._sources.get(id)?.last_success ?? null });
  }

  /**
   * @param {string} id
   */
  markSuccess(id) {
    return this.update(id, { last_success: new Date().toISOString(), last_error: null });
  }

  /**
   * @param {string} id
   */
  get(id) {
    return this._sources.get(id) || null;
  }

  /**
   * @param {{ enabledOnly?: boolean, vertical_pack?: string, type?: string }} [filter]
   * @returns {SourceRegistryEntry[]}
   */
  list(filter = {}) {
    let rows = [...this._sources.values()];
    if (filter.enabledOnly !== false) {
      rows = rows.filter((s) => s.enabled);
    } else if (filter.enabledOnly === false) {
      // include disabled
    }
    if (filter.vertical_pack) {
      rows = rows.filter(
        (s) =>
          s.vertical_pack === filter.vertical_pack ||
          (s.supported_vertical_packs || []).includes(filter.vertical_pack)
      );
    }
    if (filter.type) {
      rows = rows.filter((s) => s.type === filter.type);
    }
    return rows.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }

  /**
   * Load/replace from plain JSON array (e.g. admin export). No hardcoded URLs in callers.
   * @param {object[]} entries
   */
  loadAll(entries) {
    this._sources.clear();
    for (const e of entries) {
      this.register(/** @type {any} */ (e));
    }
    return this.list({ enabledOnly: false });
  }

  toJSON() {
    return this.list({ enabledOnly: false });
  }
}

export function createSourceRegistry(seed) {
  return new SourceRegistry(seed);
}
