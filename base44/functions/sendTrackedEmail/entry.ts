import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lead_id, lead_email, lead_name, subject, body, campaign_name, sequence_step } = await req.json();

    if (!lead_email) return Response.json({ error: 'lead_email is required' }, { status: 400 });

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

    // Save record first
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

    // Send the email
    await base44.integrations.Core.SendEmail({
      to: lead_email,
      subject,
      body: htmlBody
    });

    return Response.json({ success: true, record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});