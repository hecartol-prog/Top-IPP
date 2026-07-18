/**
 * Pipeline stage logging — time, source, company, evidence, result, errors.
 */

/**
 * @typedef {import('../types.js').StageLogEntry} StageLogEntry
 */

export class PipelineLogger {
  constructor() {
    /** @type {StageLogEntry[]} */
    this.entries = [];
  }

  /**
   * @param {Omit<StageLogEntry, 'time'> & { time?: string }} entry
   */
  log(entry) {
    const row = {
      time: entry.time || new Date().toISOString(),
      stage: entry.stage,
      source: entry.source,
      company: entry.company,
      evidence: entry.evidence,
      result: entry.result,
      message: entry.message,
      error: entry.error,
    };
    this.entries.push(row);
    return row;
  }

  clear() {
    this.entries = [];
  }

  /**
   * @param {string} [stage]
   */
  byStage(stage) {
    if (!stage) return [...this.entries];
    return this.entries.filter((e) => e.stage === stage);
  }

  summary() {
    const counts = { ok: 0, skip: 0, reject: 0, error: 0 };
    for (const e of this.entries) {
      counts[e.result] = (counts[e.result] || 0) + 1;
    }
    return { total: this.entries.length, counts, entries: this.entries };
  }
}
