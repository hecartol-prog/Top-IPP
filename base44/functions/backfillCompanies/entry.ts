import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Milestone 1.1 — Foundation backfill
 * Links Lead.company_id from legacy company_name / website without fabricating matches.
 *
 * Body:
 *   { dry_run?: boolean, apply?: boolean, limit?: number }
 * Default: dry_run=true (safe).
 */
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDomain(website) {
  if (!website || typeof website !== 'string') return null;
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.apply === true ? false : body.dry_run !== false;
    const limit = typeof body.limit === 'number' ? body.limit : 500;

    const companies = await base44.asServiceRole.entities.Company.list('-created_date', 1000);
    const leads = await base44.asServiceRole.entities.Lead.list('-created_date', limit);

    const byDomain = new Map();
    const byNormName = new Map();

    for (const c of companies) {
      if (c.domain) {
        const key = `${c.domain}::${(c.country || '').toLowerCase()}`;
        if (!byDomain.has(c.domain)) byDomain.set(c.domain, []);
        byDomain.get(c.domain).push(c);
        byDomain.set(key, c);
      }
      const nn = c.normalized_name || normalizeName(c.name);
      if (nn) {
        if (!byNormName.has(nn)) byNormName.set(nn, []);
        byNormName.get(nn).push(c);
      }
    }

    const report = {
      dry_run: dryRun,
      companies_seen: companies.length,
      leads_seen: leads.length,
      linked: [],
      created_companies: [],
      unresolved: [],
      skipped_already_linked: 0,
      applied: !dryRun,
    };

    for (const lead of leads) {
      if (lead.company_id) {
        report.skipped_already_linked += 1;
        continue;
      }

      const companyName = lead.company_name;
      if (!companyName || !String(companyName).trim()) {
        report.unresolved.push({
          lead_id: lead.id,
          reason: 'missing_company_name',
        });
        if (!dryRun) {
          await base44.asServiceRole.entities.Lead.update(lead.id, {
            migration_unresolved: true,
          });
        }
        continue;
      }

      const domain = extractDomain(lead.website);
      const nn = normalizeName(companyName);
      let match = null;
      let matchMethod = null;

      if (domain && byDomain.has(domain)) {
        const candidates = byDomain.get(domain);
        if (Array.isArray(candidates)) {
          if (candidates.length === 1) {
            match = candidates[0];
            matchMethod = 'domain_unique';
          } else {
            const countryMatch = candidates.filter(
              (c) =>
                !lead.country ||
                !c.country ||
                String(c.country).toLowerCase() === String(lead.country).toLowerCase()
            );
            if (countryMatch.length === 1) {
              match = countryMatch[0];
              matchMethod = 'domain_country';
            }
          }
        } else {
          match = candidates;
          matchMethod = 'domain_key';
        }
      }

      if (!match && nn && byNormName.has(nn)) {
        const candidates = byNormName.get(nn);
        const countryFiltered = candidates.filter(
          (c) =>
            !lead.country ||
            !c.country ||
            String(c.country).toLowerCase() === String(lead.country).toLowerCase()
        );
        if (countryFiltered.length === 1) {
          match = countryFiltered[0];
          matchMethod = 'normalized_name_country';
        } else if (candidates.length === 1 && !lead.country) {
          match = candidates[0];
          matchMethod = 'normalized_name_unique';
        }
      }

      if (match) {
        report.linked.push({
          lead_id: lead.id,
          company_id: match.id,
          method: matchMethod,
          company_name: companyName,
        });
        if (!dryRun) {
          await base44.asServiceRole.entities.Lead.update(lead.id, {
            company_id: match.id,
            migration_unresolved: false,
          });
        }
        continue;
      }

      // Ambiguous or no company: create Company only when name is unique among unresolved leads? 
      // Safer: create new Company from lead firmographics when no match (1:1 from distinct name+country+domain)
      // Only auto-create when we have a clear identity and no ambiguous candidates
      const ambiguousName =
        nn && byNormName.has(nn) && (byNormName.get(nn) || []).length > 1;

      if (ambiguousName) {
        report.unresolved.push({
          lead_id: lead.id,
          reason: 'ambiguous_company_name',
          company_name: companyName,
        });
        if (!dryRun) {
          await base44.asServiceRole.entities.Lead.update(lead.id, {
            migration_unresolved: true,
          });
        }
        continue;
      }

      // Create company from lead data (not fabricating — using existing lead fields)
      const newCompanyPayload = {
        name: companyName.trim(),
        normalized_name: nn,
        website: lead.website || '',
        domain: domain || '',
        country: lead.country || '',
        industry: lead.industry || '',
        industry_raw: lead.industry || '',
        size: lead.company_size || undefined,
        location: lead.location || '',
        description: lead.company_description || '',
        linkedin_url: lead.company_linkedin || '',
        verification_status: 'unverified',
        path_a_status: 'observed',
        source_provenance: lead.source || 'crm_backfill',
        relationship_score: 0,
        migration_unresolved: false,
      };

      report.created_companies.push({
        lead_id: lead.id,
        company_name: companyName,
        domain: domain || null,
      });

      if (!dryRun) {
        const created = await base44.asServiceRole.entities.Company.create(newCompanyPayload);
        await base44.asServiceRole.entities.Lead.update(lead.id, {
          company_id: created.id,
          migration_unresolved: false,
        });
        // Keep maps warm for subsequent leads in same run
        if (created.domain) {
          if (!byDomain.has(created.domain)) byDomain.set(created.domain, []);
          byDomain.get(created.domain).push(created);
        }
        if (nn) {
          if (!byNormName.has(nn)) byNormName.set(nn, []);
          byNormName.get(nn).push(created);
        }
      }
    }

    report.summary = {
      linked: report.linked.length,
      created_companies: report.created_companies.length,
      unresolved: report.unresolved.length,
      skipped_already_linked: report.skipped_already_linked,
    };

    return Response.json({ ok: true, ...report });
  } catch (error) {
    console.error('backfillCompanies error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
