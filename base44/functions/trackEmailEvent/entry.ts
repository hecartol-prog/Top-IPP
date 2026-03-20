import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// 1x1 transparent GIF bytes
const PIXEL_GIF = new Uint8Array([
  71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,0,0,0,
  33,249,4,0,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59
]);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const tracking_id = url.searchParams.get('tracking_id');
    const type = url.searchParams.get('type'); // 'open' or 'click'
    const redirect = url.searchParams.get('redirect');

    if (tracking_id && type) {
      const base44 = createClientFromRequest(req);
      const records = await base44.asServiceRole.entities.EmailOutreach.filter({ tracking_id });

      if (records.length > 0) {
        const record = records[0];
        const updates = {};

        if (type === 'open') {
          updates.open_count = (record.open_count || 0) + 1;
          if (!record.opened_at) {
            updates.opened_at = new Date().toISOString();
            if (record.status === 'sent') updates.status = 'opened';
          }
        } else if (type === 'click') {
          updates.click_count = (record.click_count || 0) + 1;
          if (!record.clicked_at) updates.clicked_at = new Date().toISOString();
          if (!['clicked', 'replied'].includes(record.status)) updates.status = 'clicked';
        }

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.EmailOutreach.update(record.id, updates);
        }
      }
    }

    if (type === 'open') {
      return new Response(PIXEL_GIF, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
    }

    if (type === 'click' && redirect) {
      return Response.redirect(decodeURIComponent(redirect), 302);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    // Always return pixel even on error to avoid broken images in emails
    return new Response(PIXEL_GIF, { headers: { 'Content-Type': 'image/gif' } });
  }
});