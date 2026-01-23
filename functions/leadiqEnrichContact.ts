import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { linkedin_url, full_name, company_name } = await req.json();

        if (!linkedin_url && !full_name) {
            return Response.json({ 
                error: 'Either linkedin_url or full_name is required' 
            }, { status: 400 });
        }

        const apiKey = Deno.env.get("LEADIQ_API_KEY");
        
        if (!apiKey) {
            return Response.json({ 
                error: 'LeadIQ API key not configured' 
            }, { status: 500 });
        }

        // LeadIQ API endpoint for enriching contacts
        const searchParams = new URLSearchParams();
        if (linkedin_url) {
            searchParams.append('linkedin_url', linkedin_url);
        }
        if (full_name) {
            searchParams.append('name', full_name);
        }
        if (company_name) {
            searchParams.append('company', company_name);
        }

        const response = await fetch(
            `https://api.leadiq.com/v1/contacts/enrich?${searchParams.toString()}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
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

        // Transform LeadIQ data to our Lead entity format
        const enrichedData = {
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            email: data.email || data.verified_email || '',
            phone: data.phone || data.mobile_phone || '',
            job_title: data.title || data.position || '',
            company_name: data.company?.name || company_name || '',
            linkedin_url: data.linkedin_url || linkedin_url || '',
            location: data.location || data.city || '',
            source: 'leadiq',
            status: 'new',
            priority: 'medium',
            // Additional company info if available
            company_size: data.company?.employee_count || '',
            industry: data.company?.industry || '',
            website: data.company?.website || ''
        };

        return Response.json({
            success: true,
            data: enrichedData,
            raw: data // Include raw data for reference
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});