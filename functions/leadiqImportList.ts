import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { list_id } = await req.json();

        if (!list_id) {
            return Response.json({ error: 'list_id is required' }, { status: 400 });
        }

        const apiKey = Deno.env.get("LEADIQ_API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'LeadIQ API key not configured' }, { status: 500 });
        }

        // Get contacts from the list
        const response = await fetch(`https://api.leadiq.com/v2/lists/${list_id}/contacts`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({ 
                error: 'Failed to fetch list contacts', 
                details: errorText 
            }, { status: response.status });
        }

        const data = await response.json();
        const contacts = data.contacts || data.data || [];

        // Transform and import to CRM
        const leadsToCreate = contacts.map(contact => ({
            first_name: contact.firstName || contact.first_name || '',
            last_name: contact.lastName || contact.last_name || '',
            email: contact.email || contact.emails?.[0] || '',
            phone: contact.phone || contact.phones?.[0] || '',
            job_title: contact.title || contact.jobTitle || '',
            company_name: contact.company?.name || contact.companyName || '',
            company_size: contact.company?.employeeCount || '',
            industry: contact.company?.industry || '',
            linkedin_url: contact.linkedInUrl || contact.linkedin_url || '',
            website: contact.company?.website || '',
            location: contact.location || contact.city || '',
            source: 'leadiq',
            status: 'new',
            priority: 'medium'
        })).filter(lead => lead.email && lead.first_name && lead.last_name);

        // Bulk create leads
        const createdLeads = [];
        for (const leadData of leadsToCreate) {
            try {
                const lead = await base44.asServiceRole.entities.Lead.create(leadData);
                createdLeads.push(lead);
            } catch (error) {
                console.error('Failed to create lead:', error);
            }
        }

        return Response.json({ 
            success: true, 
            imported: createdLeads.length,
            total: contacts.length
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});