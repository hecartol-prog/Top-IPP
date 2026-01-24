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

        const query = `
            query {
                lists {
                    id
                    name
                    contactCount
                }
            }
        `;

        const response = await fetch('https://api.leadiq.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({ 
                error: 'Failed to fetch LeadIQ lists', 
                details: errorText 
            }, { status: response.status });
        }

        const data = await response.json();
        return Response.json(data.data?.lists || []);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});