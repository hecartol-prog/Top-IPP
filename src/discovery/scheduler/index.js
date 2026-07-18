/**
 * Discovery scheduler interface.
 * Supports: manual run now; future cron / webhook / queue worker hooks.
 * No real cron configuration in Sprint 2.1.
 */

import { runDiscoveryPipeline } from '../pipeline/index.js';
import { PipelineLogger } from '../pipeline/logger.js';

/**
 * @typedef {import('../pipeline/index.js').DiscoveryRepos} DiscoveryRepos
 * @typedef {import('../types.js').AdapterKind} AdapterKind
 * @typedef {import('../adapters/index.js').AdapterInput} AdapterInput
 */

/**
 * @typedef {Object} DiscoveryJob
 * @property {string} id
 * @property {AdapterKind} adapterKind
 * @property {AdapterInput} adapterInput
 * @property {'manual'|'cron'|'webhook'|'queue'} trigger
 */

/**
 * @typedef {Object} SchedulerHooks
 * @property {(job: DiscoveryJob) => Promise<void>|void} [onCronRegister]
 * @property {(job: DiscoveryJob) => Promise<void>|void} [onWebhookRegister]
 * @property {(job: DiscoveryJob) => Promise<void>|void} [onQueueEnqueue]
 */

export class DiscoveryScheduler {
  /**
   * @param {DiscoveryRepos} repos
   * @param {SchedulerHooks} [hooks]
   */
  constructor(repos, hooks = {}) {
    this.repos = repos;
    this.hooks = hooks;
    /** @type {DiscoveryJob[]} */
    this.registered = [];
    /** @type {object[]} */
    this.history = [];
  }

  /**
   * Immediate manual run.
   * @param {Omit<DiscoveryJob, 'id'|'trigger'> & { id?: string }} job
   */
  async runManual(job) {
    const full = {
      id: job.id || `manual_${Date.now()}`,
      adapterKind: job.adapterKind,
      adapterInput: job.adapterInput,
      trigger: /** @type {const} */ ('manual'),
    };
    return this.#execute(full);
  }

  /**
   * Register a future cron job (no OS cron — hook only).
   * @param {Omit<DiscoveryJob, 'trigger'> & { cronExpression?: string }} job
   */
  async scheduleCron(job) {
    const full = {
      id: job.id,
      adapterKind: job.adapterKind,
      adapterInput: job.adapterInput,
      trigger: /** @type {const} */ ('cron'),
      cronExpression: job.cronExpression,
    };
    this.registered.push(full);
    if (this.hooks.onCronRegister) await this.hooks.onCronRegister(full);
    return { registered: true, job: full };
  }

  /**
   * Register webhook-triggered discovery (interface only).
   * @param {Omit<DiscoveryJob, 'trigger'>} job
   */
  async registerWebhook(job) {
    const full = { ...job, trigger: /** @type {const} */ ('webhook') };
    this.registered.push(full);
    if (this.hooks.onWebhookRegister) await this.hooks.onWebhookRegister(full);
    return { registered: true, job: full };
  }

  /**
   * Enqueue for a future queue worker (interface only).
   * @param {Omit<DiscoveryJob, 'trigger'>} job
   */
  async enqueue(job) {
    const full = { ...job, trigger: /** @type {const} */ ('queue') };
    this.registered.push(full);
    if (this.hooks.onQueueEnqueue) await this.hooks.onQueueEnqueue(full);
    return { enqueued: true, job: full };
  }

  /**
   * Process a previously registered / external job payload.
   * @param {DiscoveryJob} job
   */
  async runJob(job) {
    return this.#execute(job);
  }

  /**
   * @param {DiscoveryJob} job
   */
  async #execute(job) {
    const logger = new PipelineLogger();
    const started = new Date().toISOString();
    const result = await runDiscoveryPipeline({
      adapterKind: job.adapterKind,
      adapterInput: job.adapterInput,
      repos: this.repos,
      logger,
    });
    const entry = {
      job_id: job.id,
      trigger: job.trigger,
      started,
      finished: new Date().toISOString(),
      ok: result.ok,
      evidence_stored: result.evidenceStored.length,
      inbox_items: result.inboxItems.length,
      rejected: result.evidenceRejected.length,
    };
    this.history.push(entry);
    return { ...result, schedule: entry };
  }
}
