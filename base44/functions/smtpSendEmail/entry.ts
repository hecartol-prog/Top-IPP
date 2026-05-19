import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DAILY_LIMIT = 20;

const INBOXES = {
  sales:    { name: 'Top Mold Sales', user: Deno.env.get('SMTP_SALES_USER'),    pass: Deno.env.get('SMTP_SALES_PASS') },
  topmolds: { name: 'Top Molds',      user: Deno.env.get('SMTP_TOPMOLDS_USER'), pass: Deno.env.get('SMTP_TOPMOLDS_PASS') },
  info:     { name: 'Top Mold Info',  user: Deno.env.get('SMTP_INFO_USER'),     pass: Deno.env.get('SMTP_INFO_PASS') },
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function sendEmail(base44, cfg, toEmail, toName, subject, html) {
  await base44.asServiceRole.integrations.Core.SendEmail({
    from_name: cfg.name,
    to: toEmail,
    subject: subject,
    body: html,
  });
}

async function getOrCreateStat(base44, inbox) {
  const today = todayStr();
  const existing = await base44.asServiceRole.entities.InboxStats.filter({ inbox, date: today });
  if (existing && existing.length > 0) return existing[0];
  return await base44.asServiceRole.entities.InboxStats.create({ inbox, date: today, sent_count: 0, failed_count: 0 });
}

async function incrementStat(base44, inbox, field) {
  const stat = await getOrCreateStat(base44, inbox);
  await base44.asServiceRole.entities.InboxStats.update(stat.id, { [field]: (stat[field] || 0) + 1 });
}

async function pickInbox(base44, preferredInbox) {
  const today = todayStr();
  const stats = await base44.asServiceRole.entities.InboxStats.filter({ date: today });
  const sentMap = {};
  for (const s of (stats || [])) sentMap[s.inbox] = s.sent_count || 0;
  if (preferredInbox && INBOXES[preferredInbox] && (sentMap[preferredInbox] || 0) < DAILY_LIMIT) return preferredInbox;
  for (const key of ['sales', 'topmolds', 'info']) {
    if ((sentMap[key] || 0) < DAILY_LIMIT) return key;
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── TEST CONNECTION ──────────────────────────────────────
    if (action === 'test') {
      const { inbox } = body;
      if (!INBOXES[inbox]) return Response.json({ error: 'Invalid inbox' }, { status: 400 });
      const cfg = INBOXES[inbox];
      if (!cfg.user) return Response.json({ error: `Credentials not set for ${inbox}` }, { status: 400 });
      return Response.json({ success: true, message: `Workspace inbox ${cfg.user} is configured` });
    }

    // ── SEND TEST EMAIL ──────────────────────────────────────
    if (action === 'sendTest') {
      const { inbox, to, subject: emailSubject, body: emailBody } = body;
      if (!inbox || !to) return Response.json({ error: 'inbox and to are required' }, { status: 400 });
      const cfg = INBOXES[inbox];
      if (!cfg) return Response.json({ error: 'Invalid inbox' }, { status: 400 });
      const finalSubject = emailSubject || 'Test - Top Mold CRM';
      const finalHtml = emailBody || `<p>Test email from <b>${cfg.name}</b> via Top Mold CRM.</p>`;
      await sendEmail(base44, cfg, to, null, finalSubject, finalHtml);
      console.log(`[TEST] Sent test email as "${cfg.name}" to ${to}`);
      return Response.json({ success: true, message: `Test email sent from ${cfg.user} to ${to}` });
    }

    // ── PROCESS QUEUE ────────────────────────────────────────
    if (action === 'processQueue') {
      const pending = await base44.asServiceRole.entities.EmailQueue.filter({ status: 'pending' }, 'created_date', 1);
      if (!pending || pending.length === 0) return Response.json({ processed: false, reason: 'No pending emails in queue' });
      const job = pending[0];
      const selectedInbox = await pickInbox(base44, job.inbox);
      if (!selectedInbox) return Response.json({ processed: false, reason: 'All inboxes reached daily limit of ' + DAILY_LIMIT });
      const cfg = INBOXES[selectedInbox];
      await base44.asServiceRole.entities.EmailQueue.update(job.id, { status: 'skipped' });
      try {
        const html = job.body.includes('<') ? job.body : `<p>${job.body.replace(/\n/g, '<br>')}</p>`;
        await sendEmail(base44, cfg, job.to_email, job.to_name, job.subject, html);
        await base44.asServiceRole.entities.EmailQueue.update(job.id, { status: 'sent', inbox: selectedInbox, sent_at: new Date().toISOString(), error_message: '' });
        await incrementStat(base44, selectedInbox, 'sent_count');
        console.log(`[SENT] ${cfg.name} → ${job.to_email} | ${job.subject}`);
        return Response.json({ processed: true, to: job.to_email, inbox: selectedInbox, subject: job.subject });
      } catch (err) {
        const retries = (job.retry_count || 0) + 1;
        await base44.asServiceRole.entities.EmailQueue.update(job.id, { status: retries >= 3 ? 'failed' : 'pending', retry_count: retries, error_message: err.message });
        await incrementStat(base44, selectedInbox, 'failed_count');
        console.error(`[FAILED] ${job.to_email} | ${err.message}`);
        return Response.json({ processed: false, error: err.message, retries });
      }
    }

    // ── ADD TO QUEUE ─────────────────────────────────────────
    if (action === 'addToQueue') {
      const { emails } = body;
      if (!Array.isArray(emails) || emails.length === 0) return Response.json({ error: 'emails array required' }, { status: 400 });
      const created = await base44.asServiceRole.entities.EmailQueue.bulkCreate(emails.map(e => ({ ...e, status: 'pending', retry_count: 0 })));
      return Response.json({ success: true, added: created.length });
    }

    // ── QUEUE STATUS ─────────────────────────────────────────
    if (action === 'queueStatus') {
      const all = await base44.asServiceRole.entities.EmailQueue.list('-created_date', 200);
      const stats = await base44.asServiceRole.entities.InboxStats.filter({ date: todayStr() });
      return Response.json({ queue: all, stats });
    }

    // ── INBOX STATS ──────────────────────────────────────────
    if (action === 'inboxStats') {
      const stats = await base44.asServiceRole.entities.InboxStats.filter({ date: todayStr() });
      const pending = await base44.asServiceRole.entities.EmailQueue.filter({ status: 'pending' });
      const result = {};
      for (const key of ['sales', 'topmolds', 'info']) {
        const s = (stats || []).find(x => x.inbox === key) || {};
        result[key] = { email: INBOXES[key].user, sent_today: s.sent_count || 0, failed_today: s.failed_count || 0, remaining: Math.max(0, DAILY_LIMIT - (s.sent_count || 0)) };
      }
      return Response.json({ inboxes: result, pending_count: (pending || []).length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[smtpSendEmail] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});