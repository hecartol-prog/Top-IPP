import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { lead_id, lead_email, lead_name, subject, body, campaign_name, sequence_step, attachments } = await req.json();

    if (!lead_email) return Response.json({ error: 'lead_email is required' }, { status: 400 });
    if (!subject)    return Response.json({ error: 'subject is required' }, { status: 400 });
    if (!body)       return Response.json({ error: 'body is required' }, { status: 400 });

    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) return Response.json({ error: 'BREVO_API_KEY not configured' }, { status: 500 });

    const smtpUser = Deno.env.get('SMTP_USER');
    const senderName = 'Top Industrial Molds & Plastics';
    const senderEmail = smtpUser || 'no-reply@topindustrialmolds.com';

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

    // Save outreach record
    const record = await base44.asServiceRole.entities.EmailOutreach.create({
      ...(lead_id ? { lead_id } : {}),
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

    // Build Brevo payload
    const brevoPayload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: lead_email, name: lead_name || lead_email }],
      subject,
      htmlContent: htmlBody,
    };

    // Handle attachments
    if (attachments && attachments.length > 0) {
      const brevoAttachments = [];
      for (const att of attachments) {
        const res = await fetch(att.url);
        const buffer = await res.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        brevoAttachments.push({
          name: att.name,
          content: base64,
        });
      }
      brevoPayload.attachment = brevoAttachments;
    }

    // Send via Brevo API
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      console.warn(`Brevo API error ${brevoRes.status}: ${errText} — falling back to SMTP`);

      // Fallback: Brevo SMTP
      const brevoSmtpKey = Deno.env.get('BREVO_SMTP_KEY');
      if (!brevoSmtpKey) throw new Error(`Brevo API error ${brevoRes.status}: ${errText}`);

      // Build a simple multipart/alternative email via SMTP using Brevo's relay
      const boundary = `----=_Part_${Date.now()}`;
      const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
      const rawEmail = [
        `From: "${senderName}" <${senderEmail}>`,
        `To: ${lead_name ? `"${lead_name}" <${lead_email}>` : lead_email}`,
        `Subject: ${encodedSubject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        `Content-Transfer-Encoding: base64`,
        ``,
        btoa(unescape(encodeURIComponent(htmlBody))),
        `--${boundary}--`,
      ].join('\r\n');

      const smtpPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: lead_email, name: lead_name || lead_email }],
        subject,
        htmlContent: htmlBody,
        ...(brevoPayload.attachment ? { attachment: brevoPayload.attachment } : {}),
      };

      // Use Brevo SMTP relay via their API with SMTP key as alternative auth
      const smtpFallbackRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoSmtpKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(smtpPayload),
      });

      if (!smtpFallbackRes.ok) {
        const smtpErr = await smtpFallbackRes.text();
        throw new Error(`Both Brevo API and SMTP fallback failed. SMTP error: ${smtpErr}`);
      }
    }

    return Response.json({ success: true, record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});