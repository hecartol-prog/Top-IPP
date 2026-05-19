import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';

const DAILY_LIMIT = 20;

const INBOXES = {
  sales:    { name: 'Top Industrial Molds and Plastics Ltd.', user: Deno.env.get('SMTP_SALES_USER'),    pass: Deno.env.get('SMTP_SALES_PASS') },
  topmolds: { name: 'Top Molds',                              user: Deno.env.get('SMTP_TOPMOLDS_USER'), pass: Deno.env.get('SMTP_TOPMOLDS_PASS') },
  info:     { name: 'Top Industrial Molds and Plastics Ltd.', user: Deno.env.get('SMTP_INFO_USER'),     pass: Deno.env.get('SMTP_INFO_PASS') },
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

async function pickInbox(base44, preferredInbox) {
  const stats = await base44.asServiceRole.entities.InboxStats.filter({ date: todayStr() });
  const sentMap = {};
  for (const s of (stats || [])) sentMap[s.inbox] = s.sent_count || 0;
  if (preferredInbox && INBOXES[preferredInbox] && (sentMap[preferredInbox] || 0) < DAILY_LIMIT) return preferredInbox;
  for (const key of ['sales', 'topmolds', 'info']) {
    if ((sentMap[key] || 0) < DAILY_LIMIT) return key;
  }
  return null;
}

async function incrementStat(base44, inbox) {
  const today = todayStr();
  const existing = await base44.asServiceRole.entities.InboxStats.filter({ inbox, date: today });
  if (existing?.length > 0) {
    await base44.asServiceRole.entities.InboxStats.update(existing[0].id, { sent_count: (existing[0].sent_count || 0) + 1 });
  } else {
    await base44.asServiceRole.entities.InboxStats.create({ inbox, date: today, sent_count: 1, failed_count: 0 });
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { lead_id, lead_email, lead_name, subject, body, campaign_name, sequence_step, inbox: preferredInbox, email_provider = 'workspace' } = await req.json();

    if (!lead_email) return Response.json({ error: 'lead_email is required' }, { status: 400 });
    if (!subject)    return Response.json({ error: 'subject is required' }, { status: 400 });
    if (!body)       return Response.json({ error: 'body is required' }, { status: 400 });

    const selectedInbox = await pickInbox(base44, preferredInbox || 'sales');
    if (!selectedInbox) {
      return Response.json({ error: 'All inboxes have reached the daily send limit of ' + DAILY_LIMIT }, { status: 429 });
    }

    const cfg = INBOXES[selectedInbox];
    const htmlBody = body.includes('<') ? body : `<p>${body.replace(/\n/g, '<br>')}</p>`;

    if (email_provider === 'workspace') {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: cfg.user, pass: cfg.pass },
      });
      const to = lead_name ? `"${lead_name}" <${lead_email}>` : lead_email;
      await transporter.sendMail({
        from: `"${cfg.name}" <${cfg.user}>`,
        to,
        subject,
        html: htmlBody,
      });
    } else {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: cfg.name,
        to: lead_email,
        subject,
        body: htmlBody,
      });
    }

    console.log(`[sendTrackedEmail][${email_provider}] Sent as "${cfg.name}" → ${lead_email} | ${subject}`);

    await incrementStat(base44, selectedInbox);

    const tracking_id = crypto.randomUUID();
    const createPayload = {
      lead_email,
      lead_name: lead_name || '',
      subject,
      body,
      campaign_name: campaign_name || 'Manual Outreach',
      sequence_step: sequence_step || 1,
      status: 'sent',
      sent_at: new Date().toISOString(),
      tracking_id,
      open_count: 0,
      click_count: 0,
    };
    if (lead_id) createPayload.lead_id = lead_id;

    const record = await base44.asServiceRole.entities.EmailOutreach.create(createPayload);

    return Response.json({ success: true, inbox: selectedInbox, provider: email_provider, record });

  } catch (error) {
    console.error('[sendTrackedEmail] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});