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

    const senderName = 'Top Industrial Molds & Plastics';
    const senderEmail = 'contact@moldsandplastics.com';

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

    // Build Brevo API payload
    const brevoPayload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: lead_email, name: lead_name || lead_email }],
      subject,
      htmlContent: htmlBody,
    };

    // Handle attachments (fetch and base64-encode)
    if (attachments && attachments.length > 0) {
      const brevoAttachments = [];
      for (const att of attachments) {
        const res = await fetch(att.url);
        const buffer = await res.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        brevoAttachments.push({ name: att.name, content: base64 });
      }
      brevoPayload.attachment = brevoAttachments;
    }

    // Send via Brevo Transactional Email API
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(brevoPayload),
    });

    const brevoText = await brevoRes.text();
    if (!brevoRes.ok) {
      console.error(`Brevo API error ${brevoRes.status}: ${brevoText}`);
      throw new Error(`Brevo send failed (${brevoRes.status}): ${brevoText}`);
    }

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