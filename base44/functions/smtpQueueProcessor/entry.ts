import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// This function is called by the scheduler to process one email from the queue
// It delegates to smtpSendEmail with action=processQueue
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role to invoke the send function
    const result = await base44.asServiceRole.functions.invoke('smtpSendEmail', {
      action: 'processQueue'
    });

    console.log('[QueueProcessor] Result:', JSON.stringify(result?.data || result));
    return Response.json({ success: true, result: result?.data || result });

  } catch (error) {
    console.error('[QueueProcessor] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});