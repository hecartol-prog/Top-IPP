/**
 * In-memory repositories for unit / fixture testing.
 * Production wiring uses Base44 entity SDK (services/persistence.js).
 */

/**
 * @typedef {import('../types.js').CompanyRecord} CompanyRecord
 * @typedef {import('../types.js').EvidenceRecord} EvidenceRecord
 * @typedef {import('../types.js').InboxItemRecord} InboxItemRecord
 */

function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createMemoryCompanyRepo(seed = []) {
  /** @type {CompanyRecord[]} */
  const rows = seed.map((c) => ({ ...c }));
  return {
    async list() {
      return rows.map((r) => ({ ...r }));
    },
    async create(data) {
      const row = { id: data.id || id('co'), ...data };
      rows.push(row);
      return { ...row };
    },
    _rows: rows,
  };
}

export function createMemoryEvidenceRepo(seed = []) {
  /** @type {EvidenceRecord[]} */
  const rows = seed.map((e) => ({ ...e }));
  return {
    async list(filter = {}) {
      return rows
        .filter((e) => {
          if (filter.company_id && e.company_id !== filter.company_id) return false;
          if (filter.status && e.status !== filter.status) return false;
          return true;
        })
        .map((r) => ({ ...r }));
    },
    async create(data) {
      const row = { id: data.id || id('ev'), ...data };
      rows.push(row);
      return { ...row };
    },
    _rows: rows,
  };
}

export function createMemoryInboxRepo(seed = []) {
  /** @type {InboxItemRecord[]} */
  const rows = seed.map((i) => ({ ...i }));
  return {
    async list(filter = {}) {
      return rows
        .filter((e) => {
          if (filter.company_id && e.company_id !== filter.company_id) return false;
          if (filter.status && e.status !== filter.status) return false;
          return true;
        })
        .map((r) => ({ ...r }));
    },
    async create(data) {
      const row = { id: data.id || id('inbox'), status: data.status || 'pending', ...data };
      rows.push(row);
      return { ...row };
    },
    _rows: rows,
  };
}
