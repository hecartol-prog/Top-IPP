import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            company_name, 
            job_titles, 
            location,
            industry,
            company_size,
            limit = 10 
        } = await req.json();

        if (!company_name && !industry) {
            return Response.json({ 
                error: 'Either company_name or industry is required' 
            }, { status: 400 });
        }

        const apiKey = Deno.env.get("LEADIQ_API_KEY");
        
        if (!apiKey) {
            return Response.json({ 
                error: 'LeadIQ API key not configured' 
            }, { status: 500 });
        }

        // Build search payload
        const searchPayload = {
            filters: {},
            limit: Math.min(limit, 50) // Cap at 50 per API limits
        };

        if (company_name) {
            searchPayload.filters.company_name = company_name;
        }

        if (job_titles && Array.isArray(job_titles)) {
            searchPayload.filters.job_titles = job_titles;
        }

        if (location) {
            searchPayload.filters.location = location;
        }

        if (industry) {
            searchPayload.filters.industry = industry;
        }

        if (company_size) {
            searchPayload.filters.company_size = company_size;
        }

        const response = await fetch(
            'https://api.leadiq.com/v1/contacts/search',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchPayload)
            }
        );

        if (!response.ok) {
            const errorData = await response.text();
            return Response.json({ 
                error: 'LeadIQ API error',
                details: errorData,
                status: response.status
            }, { status: response.status });
        }

        const data = await response.json();

        // Transform results to our Lead entity format
        const prospects = (data.contacts || data.results || []).map(contact => ({
            first_name: contact.first_name || '',
            last_name: contact.last_name || '',
            email: contact.email || contact.verified_email || '',
            phone: contact.phone || contact.mobile_phone || '',
            job_title: contact.title || contact.position || '',
            company_name: contact.company?.name || company_name || '',
            company_size: contact.company?.employee_count || company_size || '',
            industry: contact.company?.industry || industry || '',
            linkedin_url: contact.linkedin_url || '',
            website: contact.company?.website || '',
            location: contact.location || contact.city || location || '',
            source: 'leadiq',
            status: 'new',
            priority: 'medium'
        }));

        return Response.json({
            success: true,
            count: prospects.length,
            prospects: prospects,
            raw: data // Include raw data for reference
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});