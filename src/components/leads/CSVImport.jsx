import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle2, FileText, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

const ACCEPTED_TYPES = ".csv,.xlsx,.xls,.pdf,.ppt,.pptx,.doc,.docx,.json,.txt";

const LEAD_SCHEMA = {
  type: "object",
  properties: {
    leads: {
      type: "array",
      items: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          job_title: { type: "string" },
          company_name: { type: "string" },
          company_size: { type: "string" },
          industry: { type: "string" },
          linkedin_url: { type: "string" },
          website: { type: "string" },
          location: { type: "string" },
          notes: { type: "string" }
        }
      }
    }
  }
};

export default function LeadCSVImport({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setMessage({ type: "error", text: "Please select a file first" });
      return;
    }

    setUploading(true);
    setMessage(null);

    // Upload the file
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setMessage({ type: "info", text: "Extracting leads from file with AI..." });

    // Use AI to extract leads from any file format
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: LEAD_SCHEMA
    });

    if (result.status === "error") {
      setMessage({ type: "error", text: result.details || "Failed to extract data from file." });
      setUploading(false);
      return;
    }

    let leadsData = result.output?.leads || (Array.isArray(result.output) ? result.output : []);

    if (leadsData.length === 0) {
      setMessage({ type: "error", text: "No leads found in the file. Make sure it contains contact or company data." });
      setUploading(false);
      return;
    }

    // Import leads into the database
    let imported = 0;
    for (const lead of leadsData) {
      const companyName = lead.company_name || lead.company || "";
      const firstName = lead.first_name || (lead.name ? lead.name.split(" ")[0] : "") || companyName.split(" ")[0] || "Unknown";
      const lastName = lead.last_name || (lead.name ? lead.name.split(" ").slice(1).join(" ") : "") || "";

      if (!firstName && !companyName) continue;

      await base44.entities.Lead.create({
        first_name: firstName,
        last_name: lastName,
        email: lead.email || "",
        phone: lead.phone || lead.phone_number || "",
        job_title: lead.job_title || lead.title || "",
        company_name: companyName,
        company_size: lead.company_size || "",
        industry: lead.industry || "",
        linkedin_url: lead.linkedin_url || lead.linkedin || "",
        website: lead.website || lead.company_website || "",
        location: lead.location || "",
        notes: lead.notes || "",
        status: "new",
        source: "other"
      });
      imported++;
    }

    setMessage({
      type: "success",
      text: `Successfully imported ${imported} lead${imported !== 1 ? "s" : ""} from ${file.name}`
    });
    setFile(null);
    setUploading(false);

    if (onImportComplete) onImportComplete();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Import Leads from File
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert className={
            message.type === "success" ? "bg-emerald-50 border-emerald-200" :
            message.type === "info" ? "bg-blue-50 border-blue-200" :
            "bg-red-50 border-red-200"
          }>
            {message.type === "success" && <CheckCircle2 className="w-4 h-4 inline mr-2 text-emerald-600" />}
            {message.type === "error" && <AlertCircle className="w-4 h-4 inline mr-2 text-red-600" />}
            <AlertDescription className={
              message.type === "success" ? "text-emerald-800" :
              message.type === "info" ? "text-blue-800" :
              "text-red-800"
            }>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Input
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            disabled={uploading}
          />

          {file && (
            <div className="text-sm text-slate-600 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {file.name}
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Import Leads</>
            )}
          </Button>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            <strong className="text-slate-600">Supported formats:</strong> CSV, Excel (XLSX/XLS), PDF, PowerPoint (PPT/PPTX), Word (DOC/DOCX), JSON, TXT
          </p>
          <p className="text-xs text-slate-400 mt-1">
            AI will automatically extract contact and company information from any format.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}