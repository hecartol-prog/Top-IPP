import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';

const DAILY_LIMIT = 20;

// Inbox configuration — loaded from env secrets
const INBOXES = {
  sales: {
    user: Deno.env.get('SMTP_SALES_USER'),
    pass: Deno.env.get('SMTP_SALES_PASS'),
    name: 'Top Mold Sales',
    priority: 1
  },
  topmolds: {
    user: Deno.env.get('SMTP_TOPMOLDS_USER'),
    pass: Deno.env.get('SMTP_TOPMOLDS_PASS'),
    name: 'Top Molds',
    priority: 2
  },
  info: {
    user: Deno.env.get('SMTP_INFO_USER'),
    pass: Deno.env.get('SMTP_INFO_PASS'),
    name: 'Top Mold Info',
    priority: 3
  }
};

function createTransporter(inbox) {
  const cfg = INBOXES[inbox];
  if (!cfg || !cfg.user || !cfg.pass) throw new Error(`Missing SMTP credentials for inbox: ${inbox}`);
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false }
  });
}

// Get today's date as YYYY-MM-DD
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// Get or create today's stat record for an inbox
async function getOrCreateStat(base44, inbox) {
  const today = todayStr();
  const existing = await base44.asServiceRole.entities.InboxStats.filter({ inbox, date: today });
  if (existing && existing.length > 0) return existing[0];
  const created = await base44.asServiceRole.entities.InboxStats.create({ inbox, date: today, sent_count: 0, failed_count: 0 });
  return created;
}

// Increment stat counter
async function incrementStat(base44, inbox, field) {
  const stat = await getOrCreateStat(base44, inbox);
  await base44.asServiceRole.entities.InboxStats.update(stat.id, {
    [field]: (stat[field] || 0) + 1
  });
}

// Pick the best available inbox for rotation
async function pickInbox(base44, preferredInbox) {
  const today = todayStr();
  const stats = await base44.asServiceRole.entities.InboxStats.filter({ date: today });
  const sentMap = {};
  for (const s of (stats || [])) sentMap[s.inbox] = s.sent_count || 0;

  // If preferred inbox is under limit, use it
  if (preferredInbox && INBOXES[preferredInbox]) {
    if ((sentMap[preferredInbox] || 0) < DAILY_LIMIT) return preferredInbox;
  }

  // Rotate: pick inbox with fewest sent today that is under limit
  const order = ['sales', 'topmolds', 'info'];
  let best = null;
  let bestCount = Infinity;
  for (const key of order) {
    const count = sentMap[key] || 0;
    if (count < DAILY_LIMIT && count < bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best; // null means all inboxes are at daily limit
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
      if (!cfg.user || !cfg.pass) return Response.json({ error: `Credentials not set for ${inbox}` }, { status: 400 });
      const transporter = createTransporter(inbox);
      await transporter.verify();
      return Response.json({ success: true, message: `SMTP connection verified for ${cfg.user}` });
    }

    // ── SEND TEST EMAIL ──────────────────────────────────────
    if (action === 'sendTest') {
      const { inbox, to, subject: emailSubject, body: emailBody } = body;
      if (!inbox || !to) return Response.json({ error: 'inbox and to are required' }, { status: 400 });
      const cfg = INBOXES[inbox];
      const transporter = createTransporter(inbox);
      const finalSubject = emailSubject || 'SMTP Test - Top Mold CRM';
      const finalHtml = emailBody || `<p>This is a test email sent from the <b>${inbox}</b> inbox via Top Mold CRM.</p>`;
      await transporter.sendMail({
        from: `"${cfg.name}" <${cfg.user}>`,
        to,
        subject: finalSubject,
        text: finalHtml.replace(/<[^>]*>/g, ''),
        html: finalHtml
      });
      console.log(`[TEST] Sent test email from ${cfg.user} to ${to}`);
      return Response.json({ success: true, message: `Test email sent from ${cfg.user} to ${to}` });
    }

    // ── PROCESS QUEUE (one email at a time) ──────────────────
    if (action === 'processQueue') {
      // Get oldest pending email
      const pending = await base44.asServiceRole.entities.EmailQueue.filter(
        { status: 'pending' }, 'created_date', 1
      );
      if (!pending || pending.length === 0) {
        return Response.json({ processed: false, reason: 'No pending emails in queue' });
      }

      const job = pending[0];

      // Pick inbox with rotation
      const selectedInbox = await pickInbox(base44, job.inbox);
      if (!selectedInbox) {
        console.log('[QUEUE] All inboxes at daily limit, skipping');
        return Response.json({ processed: false, reason: 'All inboxes reached daily limit of ' + DAILY_LIMIT });
      }

      const cfg = INBOXES[selectedInbox];

      // Mark as in-progress to prevent double-processing
      await base44.asServiceRole.entities.EmailQueue.update(job.id, { status: 'skipped' });

      try {
        const transporter = createTransporter(selectedInbox);
        await transporter.sendMail({
          from: `"${cfg.name}" <${cfg.user}>`,
          to: job.to_name ? `"${job.to_name}" <${job.to_email}>` : job.to_email,
          subject: job.subject,
          text: job.body.replace(/<[^>]*>/g, ''),
          html: job.body.includes('<') ? job.body : `<p>${job.body.replace(/\n/g, '<br>')}</p>`
        });

        await base44.asServiceRole.entities.EmailQueue.update(job.id, {
          status: 'sent',
          inbox: selectedInbox,
          sent_at: new Date().toISOString(),
          error_message: ''
        });

        await incrementStat(base44, selectedInbox, 'sent_count');

        console.log(`[SENT] ${cfg.user} → ${job.to_email} | Subject: ${job.subject}`);
        return Response.json({
          processed: true,
          to: job.to_email,
          inbox: selectedInbox,
          subject: job.subject
        });
      } catch (err) {
        const retries = (job.retry_count || 0) + 1;
        await base44.asServiceRole.entities.EmailQueue.update(job.id, {
          status: retries >= 3 ? 'failed' : 'pending',
          retry_count: retries,
          error_message: err.message
        });
        await incrementStat(base44, selectedInbox, 'failed_count');
        console.error(`[FAILED] ${job.to_email} | Error: ${err.message}`);
        return Response.json({ processed: false, error: err.message, retries });
      }
    }

    // ── ADD TO QUEUE ─────────────────────────────────────────
    if (action === 'addToQueue') {
      const { emails } = body; // array of { to_email, to_name, subject, body, inbox, campaign_name, lead_id }
      if (!Array.isArray(emails) || emails.length === 0) {
        return Response.json({ error: 'emails array required' }, { status: 400 });
      }
      const created = await base44.asServiceRole.entities.EmailQueue.bulkCreate(
        emails.map(e => ({ ...e, status: 'pending', retry_count: 0 }))
      );
      return Response.json({ success: true, added: created.length });
    }

    // ── QUEUE STATUS ─────────────────────────────────────────
    if (action === 'queueStatus') {
      const all = await base44.asServiceRole.entities.EmailQueue.list('-created_date', 200);
      const today = todayStr();
      const stats = await base44.asServiceRole.entities.InboxStats.filter({ date: today });
      return Response.json({ queue: all, stats });
    }

    // ── INBOX STATS ──────────────────────────────────────────
    if (action === 'inboxStats') {
      const today = todayStr();
      const stats = await base44.asServiceRole.entities.InboxStats.filter({ date: today });
      const pending = await base44.asServiceRole.entities.EmailQueue.filter({ status: 'pending' });
      const result = {};
      for (const key of ['sales', 'topmolds', 'info']) {
        const s = (stats || []).find(x => x.inbox === key) || {};
        result[key] = {
          email: INBOXES[key].user,
          sent_today: s.sent_count || 0,
          failed_today: s.failed_count || 0,
          remaining: Math.max(0, DAILY_LIMIT - (s.sent_count || 0))
        };
      }
      return Response.json({ inboxes: result, pending_count: (pending || []).length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[smtpSendEmail] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});