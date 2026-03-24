import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import nodemailer from 'npm:nodemailer@6.9.9';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { lead_id, lead_email, lead_name, subject, body, campaign_name, sequence_step, attachments } = await req.json();

    if (!lead_email) return Response.json({ error: 'lead_email is required' }, { status: 400 });
    if (!subject)    return Response.json({ error: 'subject is required' }, { status: 400 });
    if (!body)       return Response.json({ error: 'body is required' }, { status: 400 });

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      return Response.json({ error: 'SMTP credentials not configured' }, { status: 500 });
    }

    const tracking_id = crypto.randomUUID();
    const appId = Deno.env.get('BASE44_APP_ID');
    const trackingBaseUrl = `https://api.base44.com/api/apps/${appId}/functions/trackEmailEvent`;

    // Wrap href links for click tracking
    const trackedBody = body.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (match, url) => {
        const trackedUrl = `${trackingBaseUrl}?tracking_id=${tracking_id}&type=click&redirect=${encodeURIComponent(url)}`;
        return `href="${trackedUrl}"`;
      }
    );

    // Append invisible tracking pixel
    const pixelUrl = `${trackingBaseUrl}?tracking_id=${tracking_id}&type=open`;
    const htmlBody = `${trackedBody}<img src="${pixelUrl}" width="1" height="1" style="display:none;visibility:hidden;opacity:0;" alt="" />`;

    // Save outreach record first
    const record = await base44.asServiceRole.entities.EmailOutreach.create({
      lead_id,
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
      click_count: 0
    });

    // Try SSL port 465 first, fall back to non-SSL port 26
    const smtpConfigs = [
      { port: smtpPort, secure: smtpPort === 465 },
      { port: 26,  secure: false },
      { port: 587, secure: false },
    ];

    let lastError = null;
    let sent = false;

    for (const cfg of smtpConfigs) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: cfg.port,
          secure: cfg.secure,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 10000,
        });
        await transporter.sendMail({
          from: `"Top Industrial Molds & Plastics" <${smtpUser}>`,
          to: lead_email,
          subject,
          html: htmlBody,
        });
        sent = true;
        break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!sent) throw lastError;

    return Response.json({ success: true, record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});