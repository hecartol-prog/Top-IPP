import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
const APOLLO_BASE = "https://api.apollo.io/v1";

async function apolloRequest(path, body) {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": APOLLO_API_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apollo API ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}

// Map Apollo company size number to enum
function mapEmployeeCount(count) {
  if (!count) return null;
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1000";
  return "1000+";
}

// Map Apollo annual revenue to a readable string
function mapRevenue(revenue) {
  if (!revenue) return null;
  if (revenue < 1_000_000) return `<$1M`;
  if (revenue < 10_000_000) return `$1M–$10M`;
  if (revenue < 50_000_000) return `$10M–$50M`;
  if (revenue < 100_000_000) return `$50M–$100M`;
  if (revenue < 500_000_000) return `$100M–$500M`;
  return `$500M+`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { lead_id, only_missing = true } = await req.json();
    if (!lead_id) return Response.json({ error: "lead_id required" }, { status: 400 });

    // Fetch lead
    const leads = await base44.entities.Lead.filter({ id: lead_id });
    const lead = leads[0];
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

    const updatedFields = [];
    let apolloContactId = null;
    let apolloOrgId = null;
    let contactData = null;
    let orgData = null;

    // ── Step 1: People Match (contact enrichment) ──────────────────────────
    const peopleBody = {};
    if (lead.email) peopleBody.email = lead.email;
    if (lead.linkedin_url) peopleBody.linkedin_url = lead.linkedin_url;
    if (!peopleBody.email && !peopleBody.linkedin_url && lead.first_name && lead.last_name) {
      peopleBody.first_name = lead.first_name;
      peopleBody.last_name = lead.last_name;
      if (lead.company_name) peopleBody.organization_name = lead.company_name;
    }

    if (Object.keys(peopleBody).length > 0) {
      try {
        const peopleRes = await apolloRequest("/people/match", {
          ...peopleBody,
          reveal_personal_emails: true,
        });
        contactData = peopleRes?.person || null;
        if (contactData) apolloContactId = contactData.id;
      } catch (e) {
        console.log("People match failed:", e.message);
      }
    }

    // ── Step 2: Organization Match (company enrichment) ──────────────────
    const orgDomain = lead.website
      ? lead.website.replace(/https?:\/\//i, "").replace(/\/.*/, "")
      : null;

    const orgBody = {};
    if (orgDomain) orgBody.domain = orgDomain;
    else if (lead.company_name) orgBody.name = lead.company_name;

    if (Object.keys(orgBody).length > 0) {
      try {
        const orgRes = await apolloRequest("/organizations/enrich", orgBody);
        orgData = orgRes?.organization || null;
        if (orgData) apolloOrgId = orgData.id;
      } catch (e) {
        console.log("Org enrich failed:", e.message);
      }
    }

    if (!contactData && !orgData) {
      // Mark as failed
      await base44.entities.Lead.update(lead.id, {
        apollo_enrichment_status: "failed",
        apollo_last_enriched: new Date().toISOString(),
      });
      return Response.json({
        success: false,
        message: "No match found on Apollo",
        fields_updated: [],
      });
    }

    // ── Step 3: Build update payload (fill-in-missing logic) ─────────────
    const updates = {};

    const fill = (field, value) => {
      if (!value) return;
      if (only_missing && lead[field]) return; // don't overwrite existing
      if (updates[field] !== value) {
        updates[field] = value;
        updatedFields.push(field);
      }
    };

    if (contactData) {
      fill("email", contactData.email);
      fill("phone", contactData.phone_numbers?.[0]?.sanitized_number || contactData.direct_dial_number);
      fill("job_title", contactData.title);
      fill("linkedin_url", contactData.linkedin_url);
      fill("first_name", contactData.first_name);
      fill("last_name", contactData.last_name);
      if (contactData.email_status) {
        fill("apollo_email_status", contactData.email_status);
      }
      if (contactData.id && !lead.apollo_contact_id) {
        updates.apollo_contact_id = contactData.id;
        updatedFields.push("apollo_contact_id");
      }
    }

    if (orgData) {
      fill("company_name", orgData.name);
      fill("website", orgData.website_url);
      fill("industry", orgData.industry);
      fill("location", [orgData.city, orgData.country].filter(Boolean).join(", "));
      fill("country", orgData.country);

      const mappedSize = mapEmployeeCount(orgData.estimated_num_employees);
      fill("company_size", mappedSize);

      if (orgData.linkedin_url && !lead.company_linkedin) {
        updates.company_linkedin = orgData.linkedin_url;
        updatedFields.push("company_linkedin");
      }

      const revenue = mapRevenue(orgData.annual_revenue);
      fill("revenue_range", revenue);

      if (orgData.short_description && !lead.company_description) {
        updates.company_description = orgData.short_description;
        updatedFields.push("company_description");
      }

      if (orgData.technology_names?.length > 0 && !lead.technologies_used) {
        updates.technologies_used = orgData.technology_names.slice(0, 10).join(", ");
        updatedFields.push("technologies_used");
      }

      if (orgData.id && !lead.apollo_org_id) {
        updates.apollo_org_id = orgData.id;
        updatedFields.push("apollo_org_id");
      }
    }

    // ── Step 4: System fields ─────────────────────────────────────────────
    updates.apollo_enrichment_status = "enriched";
    updates.apollo_last_enriched = new Date().toISOString();

    // ── Step 5: Persist ───────────────────────────────────────────────────
    if (Object.keys(updates).length > 0) {
      await base44.entities.Lead.update(lead.id, updates);
    }

    // ── Step 6: Log activity ──────────────────────────────────────────────
    await base44.entities.Activity.create({
      lead_id: lead.id,
      type: "note",
      title: "Data enriched via Apollo.io",
      description: updatedFields.length > 0
        ? `Updated fields: ${updatedFields.filter(f => !f.startsWith("apollo_")).join(", ")}`
        : "No new fields found",
      outcome: updatedFields.length > 0 ? "positive" : "neutral",
    });

    return Response.json({
      success: true,
      fields_updated: updatedFields,
      message: updatedFields.length > 0
        ? `Enriched ${updatedFields.length} field(s) from Apollo.io`
        : "No new data found — lead may already be complete",
    });

  } catch (error) {
    console.error("apolloEnrich error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});