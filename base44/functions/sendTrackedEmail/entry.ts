import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.9';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { lead_id, lead_email, lead_name, subject, body, campaign_name, sequence_step, attachments } = await req.json();

    if (!lead_email) return Response.json({ error: 'lead_email is required' }, { status: 400 });
    if (!subject)    return Response.json({ error: 'subject is required' }, { status: 400 });
    if (!body)       return Response.json({ error: 'body is required' }, { status: 400 });

    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp-relay.brevo.com';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpUser || !smtpPass) {
      return Response.json({ error: 'SMTP_USER and SMTP_PASS secrets are required' }, { status: 500 });
    }

    const senderName = 'Top Industrial Molds & Plastics';
    const senderEmail = smtpUser;

    const tracking_id = crypto.randomUUID();
    const appId = Deno.env.get('BASE44_APP_ID');
    const trackingBaseUrl = `https://api.base44.com/api/apps/${appId}/functions/trackEmailEvent`;

    // Wrap href links for click tracking
    const trackedBody = body.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (_match, url) => {
        const trackedUrl = `${trackingBaseUrl}?tracking_id=${tracking_id}&type=click&redirect=${encodeURIComponent(url)}`;
        return `href="${trackedUrl}"`;
      }
    );

    // Append invisible tracking pixel
    const pixelUrl = `${trackingBaseUrl}?tracking_id=${tracking_id}&type=open`;
    const htmlBody = `${trackedBody}<img src="${pixelUrl}" width="1" height="1" style="display:none;visibility:hidden;opacity:0;" alt="" />`;

    // Build transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false, // STARTTLS on port 587
      auth: { user: smtpUser, pass: smtpPass },
    });

    const mailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to: lead_name ? `"${lead_name}" <${lead_email}>` : lead_email,
      subject,
      html: htmlBody,
    };

    // Handle attachments
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map(att => ({
        filename: att.name,
        path: att.url,
        contentType: att.type,
      }));
    }

    await transporter.sendMail(mailOptions);

    // Save outreach record AFTER successful send
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

    return Response.json({ success: true, record });
  } catch (error) {
    console.error('sendTrackedEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});