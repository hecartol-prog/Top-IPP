import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Linkedin, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function LinkedInImport({ onImport }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleFetch = async () => {
    if (!url.trim()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      // Use InvokeLLM with internet context to extract profile data from the LinkedIn URL
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Fetch and extract professional profile data from this LinkedIn profile URL: ${url}

Return ONLY the following fields based on what you can find from the public LinkedIn profile:
- first_name: the person's first name
- last_name: the person's last name  
- job_title: their current job title / position
- company_name: their current employer / company
- location: their location (city, country)
- profile_url: the original LinkedIn URL provided

If a field is not available, return null for it.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            job_title: { type: "string" },
            company_name: { type: "string" },
            location: { type: "string" },
            profile_url: { type: "string" }
          }
        }
      });

      const data = result;
      if (!data.first_name && !data.last_name && !data.company_name) {
        throw new Error("Could not extract profile data. Make sure the URL is a valid public LinkedIn profile.");
      }

      // Build clean lead fields
      const leadFields = {};
      if (data.first_name) leadFields.first_name = data.first_name;
      if (data.last_name) leadFields.last_name = data.last_name;
      if (data.job_title) leadFields.job_title = data.job_title;
      if (data.company_name) leadFields.company_name = data.company_name;
      if (data.location) leadFields.location = data.location;
      leadFields.linkedin_url = data.profile_url || url;
      leadFields.source = "linkedin";

      setStatus("success");
      onImport(leadFields);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Failed to fetch profile data.");
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Linkedin className="w-5 h-5 text-blue-600" />
        <span className="text-sm font-semibold text-blue-900">Import from LinkedIn</span>
      </div>
      <p className="text-xs text-blue-700">Paste a LinkedIn profile URL to auto-fill Name, Company, Job Title, and Location.</p>
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setStatus("idle"); }}
          placeholder="https://linkedin.com/in/john-smith"
          className="text-sm bg-white border-blue-200 focus:border-blue-400"
        />
        <Button
          type="button"
          onClick={handleFetch}
          disabled={!url.trim() || status === "loading"}
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          size="sm"
        >
          {status === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Fetch"
          )}
        </Button>
      </div>
      {status === "success" && (
        <div className="flex items-center gap-2 text-emerald-700 text-xs">
          <CheckCircle className="w-4 h-4" />
          Profile data imported — review fields below.
        </div>
      )}
      {status === "error" && (
        <div className="flex items-start gap-2 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}
    </div>
  );
}