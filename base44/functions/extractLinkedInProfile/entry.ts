import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: "urls array is required" }, { status: 400 });
    }

    const results = [];

    for (const profileUrl of urls) {
      try {
        console.log("Extracting LinkedIn profile:", profileUrl);
        // Clean the profile URL (strip tracking params)
        const cleanUrl = profileUrl.split("?")[0].replace(/\/$/, "");
        const username = cleanUrl.split("/in/")[1] || cleanUrl;

        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: "gemini_3_pro",
          prompt: `Search Google and LinkedIn for the person with LinkedIn username "${username}" (profile: ${cleanUrl}).

Find their professional details:
- Full name (first and last)
- Current job title / position
- Current employer / company name
- Location (city, country)
- Industry
- Email address (if public)
- Phone (if public)

Search queries to try:
1. site:linkedin.com/in/${username}
2. "${username}" linkedin profile
3. LinkedIn profile ${cleanUrl}

Return the actual values you found. If you truly cannot find a value, omit the field entirely (do NOT return the string "null").`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              first_name: { type: "string" },
              last_name: { type: "string" },
              job_title: { type: "string" },
              company_name: { type: "string" },
              location: { type: "string" },
              industry: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            }
          }
        });

        console.log("LLM result:", JSON.stringify(result));

        // Clean out "null" string values the LLM sometimes returns
        const cleaned = {};
        for (const [k, v] of Object.entries(result || {})) {
          if (v && v !== "null" && v !== "N/A" && v !== "n/a" && v.trim() !== "") {
            cleaned[k] = v;
          }
        }

        if (cleaned.first_name || cleaned.last_name || cleaned.company_name) {
          results.push({ ...cleaned, linkedin_url: profileUrl });
          console.log(`Extracted: ${cleaned.first_name} ${cleaned.last_name} @ ${cleaned.company_name}`);
        } else {
          console.log("No data extracted for:", profileUrl);
          results.push({ linkedin_url: profileUrl, _failed: true });
        }
      } catch (err) {
        console.error("Failed for", profileUrl, ":", err.message, err.stack);
        results.push({ linkedin_url: profileUrl, _failed: true, _error: err.message });
      }
    }

    return Response.json({ results });
  } catch (error) {
    console.error("extractLinkedInProfile error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});