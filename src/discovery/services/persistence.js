/**
 * Persistence adapters — Base44 entity wiring (optional runtime).
 * Discovery core stays free of SDK imports so unit tests stay pure.
 */

/**
 * @param {*} base44Client - Base44 SDK client with entities.*
 */
export function createBase44CompanyRepo(base44Client) {
  const Entity = base44Client.entities.Company;
  return {
    async list() {
      return Entity.list('-created_date', 2000);
    },
    async create(data) {
      return Entity.create(data);
    },
  };
}

/**
 * @param {*} base44Client
 */
export function createBase44EvidenceRepo(base44Client) {
  const Entity = base44Client.entities.Evidence;
  return {
    async list(filter = {}) {
      const all = await Entity.list('-created_date', 2000);
      return all.filter((e) => {
        if (filter.company_id && e.company_id !== filter.company_id) return false;
        if (filter.status && e.status !== filter.status) return false;
        return true;
      });
    },
    async create(data) {
      // Strip pipeline-only field before persistence
      const { discovery_event_type, ...rest } = data;
      void discovery_event_type;
      return Entity.create(rest);
    },
  };
}

/**
 * @param {*} base44Client
 */
export function createBase44InboxRepo(base44Client) {
  const Entity = base44Client.entities.IntelligenceInboxItem;
  return {
    async list(filter = {}) {
      const all = await Entity.list('-created_date', 2000);
      return all.filter((e) => {
        if (filter.company_id && e.company_id !== filter.company_id) return false;
        if (filter.status && e.status !== filter.status) return false;
        return true;
      });
    },
    async create(data) {
      return Entity.create(data);
    },
  };
}
