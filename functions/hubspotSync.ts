import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { direction, entity_type } = await req.json();
        const { accessToken } = await base44.asServiceRole.connectors.getConnection("hubspot");

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        const results = { contacts: 0, companies: 0, deals: 0 };

        // --- CONTACTS ---
        if (!entity_type || entity_type === 'contacts') {
            if (direction === 'to_hubspot' || direction === 'both') {
                // Push CRM leads to HubSpot contacts
                const leads = await base44.entities.Lead.list();
                for (const lead of leads) {
                    const props = {
                        firstname: lead.first_name || '',
                        lastname: lead.last_name || '',
                        email: lead.email || '',
                        phone: lead.phone || '',
                        jobtitle: lead.job_title || '',
                        company: lead.company_name || '',
                        hs_lead_status: mapStatusToHubspot(lead.status),
                    };
                    // Try to find existing contact by email
                    if (lead.email) {
                        const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: lead.email }] }]
                            })
                        });
                        const searchData = await searchRes.json();
                        if (searchData.results?.length > 0) {
                            await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${searchData.results[0].id}`, {
                                method: 'PATCH', headers, body: JSON.stringify({ properties: props })
                            });
                        } else {
                            await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
                                method: 'POST', headers, body: JSON.stringify({ properties: props })
                            });
                        }
                        results.contacts++;
                    }
                }
            }

            if (direction === 'from_hubspot' || direction === 'both') {
                // Pull HubSpot contacts into CRM leads
                const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company,hs_lead_status', { headers });
                const data = await res.json();
                for (const contact of (data.results || [])) {
                    const p = contact.properties;
                    if (!p.email) continue;
                    // Check if lead already exists
                    const existing = await base44.entities.Lead.filter({ email: p.email });
                    if (existing.length === 0) {
                        await base44.entities.Lead.create({
                            first_name: p.firstname || 'Unknown',
                            last_name: p.lastname || '',
                            email: p.email,
                            phone: p.phone || '',
                            job_title: p.jobtitle || '',
                            company_name: p.company || 'Unknown',
                            status: mapStatusFromHubspot(p.hs_lead_status),
                            source: 'other'
                        });
                        results.contacts++;
                    }
                }
            }
        }

        // --- COMPANIES ---
        if (!entity_type || entity_type === 'companies') {
            if (direction === 'to_hubspot' || direction === 'both') {
                const companies = await base44.entities.Company.list();
                for (const company of companies) {
                    const props = {
                        name: company.name,
                        website: company.website || '',
                        industry: company.industry || '',
                        description: company.description || '',
                    };
                    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/companies/search', {
                        method: 'POST', headers,
                        body: JSON.stringify({
                            filterGroups: [{ filters: [{ propertyName: 'name', operator: 'EQ', value: company.name }] }]
                        })
                    });
                    const searchData = await searchRes.json();
                    if (searchData.results?.length > 0) {
                        await fetch(`https://api.hubapi.com/crm/v3/objects/companies/${searchData.results[0].id}`, {
                            method: 'PATCH', headers, body: JSON.stringify({ properties: props })
                        });
                    } else {
                        await fetch('https://api.hubapi.com/crm/v3/objects/companies', {
                            method: 'POST', headers, body: JSON.stringify({ properties: props })
                        });
                    }
                    results.companies++;
                }
            }

            if (direction === 'from_hubspot' || direction === 'both') {
                const res = await fetch('https://api.hubapi.com/crm/v3/objects/companies?limit=100&properties=name,website,industry,description', { headers });
                const data = await res.json();
                for (const company of (data.results || [])) {
                    const p = company.properties;
                    if (!p.name) continue;
                    const existing = await base44.entities.Company.filter({ name: p.name });
                    if (existing.length === 0) {
                        await base44.entities.Company.create({
                            name: p.name,
                            website: p.website || '',
                            industry: p.industry || '',
                            description: p.description || ''
                        });
                        results.companies++;
                    }
                }
            }
        }

        // --- DEALS ---
        if (!entity_type || entity_type === 'deals') {
            if (direction === 'to_hubspot' || direction === 'both') {
                // Push leads with estimated_value as deals
                const leads = await base44.entities.Lead.filter({ estimated_value: { $exists: true } });
                for (const lead of leads) {
                    if (!lead.estimated_value) continue;
                    const props = {
                        dealname: `${lead.first_name} ${lead.last_name} - ${lead.company_name}`,
                        amount: String(lead.estimated_value),
                        dealstage: mapStageToHubspot(lead.status),
                        pipeline: 'default'
                    };
                    const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
                        method: 'POST', headers,
                        body: JSON.stringify({
                            filterGroups: [{ filters: [{ propertyName: 'dealname', operator: 'EQ', value: props.dealname }] }]
                        })
                    });
                    const searchData = await searchRes.json();
                    if (searchData.results?.length > 0) {
                        await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${searchData.results[0].id}`, {
                            method: 'PATCH', headers, body: JSON.stringify({ properties: props })
                        });
                    } else {
                        await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
                            method: 'POST', headers, body: JSON.stringify({ properties: props })
                        });
                    }
                    results.deals++;
                }
            }

            if (direction === 'from_hubspot' || direction === 'both') {
                const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate', { headers });
                const data = await res.json();
                results.deals += (data.results || []).length;
                // Deals from HubSpot are informational (already represented as leads)
            }
        }

        return Response.json({ success: true, synced: results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function mapStatusToHubspot(status) {
    const map = { new: 'NEW', contacted: 'OPEN', qualified: 'IN_PROGRESS', proposal: 'IN_PROGRESS', negotiation: 'IN_PROGRESS', won: 'CONNECTED', lost: 'UNQUALIFIED' };
    return map[status] || 'NEW';
}

function mapStatusFromHubspot(hsStatus) {
    const map = { NEW: 'new', OPEN: 'contacted', IN_PROGRESS: 'qualified', CONNECTED: 'won', UNQUALIFIED: 'lost' };
    return map[hsStatus] || 'new';
}

function mapStageToHubspot(status) {
    const map = { new: 'appointmentscheduled', contacted: 'appointmentscheduled', qualified: 'qualifiedtobuy', proposal: 'presentationscheduled', negotiation: 'decisionmakerboughtin', won: 'closedwon', lost: 'closedlost' };
    return map[status] || 'appointmentscheduled';
}