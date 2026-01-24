import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const apiKey = Deno.env.get("LEADIQ_API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'LeadIQ API key not configured' }, { status: 500 });
        }

        // LeadIQ API doesn't have a "lists" endpoint - it's for real-time searching
        // Return a message explaining this
        return Response.json({ 
            error: 'LeadIQ API does not support list management',
            message: 'LeadIQ Public API is designed for real-time contact and company searches, not for accessing saved lists. Use the search functionality instead.',
            suggestion: 'Use the search feature to find contacts in real-time by company, title, location, etc.'
        }, { status: 400 });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});