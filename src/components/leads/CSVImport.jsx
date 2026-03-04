import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle2, FileText, AlertCircle, Eye, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ACCEPTED_TYPES = ".csv,.xlsx,.xls,.pdf,.ppt,.pptx,.doc,.docx,.json,.txt,.html,.htm";

const COMPANY_SIZE_MAP = {
  "0 a 10": "1-10",
  "1 a 10": "1-10",
  "0-10": "1-10",
  "11 a 50": "11-50",
  "11-50": "11-50",
  "51 a 250": "51-200",
  "51 a 200": "51-200",
  "51-200": "51-200",
  "201 a 500": "201-500",
  "251 a 500": "201-500",
  "201-500": "201-500",
  "501 a 1000": "501-1000",
  "501-1000": "501-1000",
  "1001+": "1000+",
  "1000+": "1000+",
};

function normalizeCompanySize(raw) {
  if (!raw) return "";
  const str = String(raw).trim();
  for (const [key, val] of Object.entries(COMPANY_SIZE_MAP)) {
    if (str.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return "";
}

function cleanValue(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (s.toLowerCase() === "sin dato" || s.toLowerCase() === "n/a" || s === "0" || s === "-") return "";
  return s;
}

// Determine file type category
function getFileCategory(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  if (ext === 'csv') return 'csv';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['ppt', 'pptx'].includes(ext)) return 'powerpoint';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (ext === 'txt') return 'text';
  if (ext === 'json') return 'json';
  return 'other';
}

export default function LeadCSVImport({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState('idle'); // idle | uploading | extracting | preview | importing | done
  const [message, setMessage] = useState(null);
  const [previewLeads, setPreviewLeads] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [progress, setProgress] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage(null);
      setStep('idle');
      setPreviewLeads([]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setMessage({ type: "error", text: "Please select a file first" });
      return;
    }

    setUploading(true);
    setStep('uploading');
    setMessage(null);
    setProgress('Uploading file...');

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setStep('extracting');
    setProgress('AI is analyzing and extracting leads from your file...');

    const fileCategory = getFileCategory(file.name);

    // Use InvokeLLM with the file attached — it can handle any format
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a lead extraction expert. Analyze the attached file and extract ALL company/contact records as leads.

The file is from a Mexican industrial registry (CANACINTRA/CANACO).

Map the columns as follows (adapt to whatever columns exist in the file):
- COMPANY / EMPRESA / RAZON SOCIAL → company_name
- STATE / ESTADO → part of location
- CITY / CIUDAD → part of location (combine city + state for location)
- PHONE / TELEFONO / TEL → phone (clean up, remove "sin dato" values)  
- EMAIL / CORREO → email (skip "sin dato" values)
- FIELD / GIRO / ACTIVIDAD / SECTOR → industry
- No. OF EMPLOYEES / EMPLEADOS / TRABAJADORES → company_size (map to: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+")
- ADDRESS / DOMICILIO / CALLE → notes (put address in notes)
- CONTACT / CONTACTO → split into first_name + last_name if available

Rules:
- Extract EVERY row as a lead
- company_name is required; skip rows with no company name
- For company_size, map ranges like "0 a 10"→"1-10", "11 a 50"→"11-50", "51 a 250"→"51-200", "201 a 500"→"201-500", "501 a 1000"→"501-1000"
- Clean phone numbers: remove "sin dato", non-numeric junk
- Skip email values that are "sin dato" or placeholder text
- location = "City, State" format
- If no contact person name, set first_name to company name first word, last_name to ""
- Return ALL records from the file, even if some fields are empty

Return a JSON object with a "leads" array.`,
      file_urls: [file_url],
      response_json_schema: {
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
                website: { type: "string" },
                location: { type: "string" },
                notes: { type: "string" }
              }
            }
          }
        }
      }
    });

    let leadsData = result?.leads || [];

    // If AI returned empty (file too large for vision), fall back to plain extraction
    if (leadsData.length === 0 && (fileCategory === 'excel' || fileCategory === 'csv')) {
      setProgress('Trying alternative extraction method...');
      const fallback = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "COMPANY": { type: "string" },
              "COMPANY ": { type: "string" },
              "STATE": { type: "string" },
              "CITY": { type: "string" },
              "PHONE": { type: "string" },
              "EMAIL": { type: "string" },
              "FIELD": { type: "string" },
              "No. OF EMPLOYEEES": { type: "string" },
              "ADDRESS": { type: "string" },
              "TOWN": { type: "string" },
            }
          }
        }
      });

      if (fallback.status === "success" && Array.isArray(fallback.output) && fallback.output.length > 0) {
        leadsData = fallback.output.map(row => {
          const company = cleanValue(row["COMPANY "] || row["COMPANY"] || row["EMPRESA"] || row["RAZON SOCIAL"] || "");
          const phone = cleanValue(row["PHONE"] || row["TELEFONO"] || row["TEL"] || "");
          const email = cleanValue(row["EMAIL"] || row["CORREO"] || "");
          const state = cleanValue(row["STATE"] || row["ESTADO"] || "");
          const city = cleanValue(row["CITY"] || row["CIUDAD"] || "");
          const location = [city, state].filter(Boolean).join(", ");
          const industry = cleanValue(row["FIELD"] || row["GIRO"] || row["ACTIVIDAD"] || "");
          const empRaw = row["No. OF EMPLOYEEES"] || row["No. OF EMPLOYEES"] || row["EMPLEADOS"] || "";
          const companySize = normalizeCompanySize(empRaw);
          const address = cleanValue(row["ADDRESS"] || row["DOMICILIO"] || "");
          const town = cleanValue(row["TOWN"] || "");

          return {
            first_name: company.split(" ")[0] || "Unknown",
            last_name: "",
            email: email.toLowerCase().includes("sin dato") ? "" : email,
            phone: String(phone).toLowerCase().includes("sin dato") ? "" : String(phone),
            company_name: company,
            company_size: companySize,
            industry,
            location,
            notes: [address, town].filter(Boolean).join(", "),
          };
        }).filter(l => l.company_name);
      }
    }

    if (leadsData.length === 0) {
      setMessage({ type: "error", text: "No leads could be extracted from this file. Please check the file format and content." });
      setUploading(false);
      setStep('idle');
      return;
    }

    // Normalize and clean each lead
    const cleaned = leadsData.map((lead, i) => ({
      _id: i,
      first_name: cleanValue(lead.first_name) || (lead.company_name ? lead.company_name.split(" ")[0] : "Unknown"),
      last_name: cleanValue(lead.last_name) || "",
      email: cleanValue(lead.email),
      phone: cleanValue(String(lead.phone || "")),
      job_title: cleanValue(lead.job_title) || "",
      company_name: cleanValue(lead.company_name) || "",
      company_size: normalizeCompanySize(lead.company_size) || lead.company_size || "",
      industry: cleanValue(lead.industry) || "",
      website: cleanValue(lead.website) || "",
      location: cleanValue(lead.location) || "",
      notes: cleanValue(lead.notes) || "",
      status: "new",
      source: "other"
    })).filter(l => l.company_name || l.first_name !== "Unknown");

    setPreviewLeads(cleaned);
    setSelectedIds(new Set(cleaned.map(l => l._id)));
    setStep('preview');
    setUploading(false);
    setProgress('');
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === previewLeads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(previewLeads.map(l => l._id)));
  };

  const handleConfirmImport = async () => {
    const toImport = previewLeads.filter(l => selectedIds.has(l._id));
    setStep('importing');
    setProgress(`Importing ${toImport.length} leads...`);

    let imported = 0;
    const batchSize = 10;
    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize);
      await Promise.all(batch.map(lead => {
        const { _id, ...data } = lead;
        return base44.entities.Lead.create(data);
      }));
      imported += batch.length;
      setProgress(`Importing... ${imported}/${toImport.length}`);
    }

    setStep('done');
    setMessage({ type: "success", text: `Successfully imported ${imported} lead${imported !== 1 ? "s" : ""}!` });
    setFile(null);
    setPreviewLeads([]);
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

        {/* Step: idle / uploading / extracting */}
        {(step === 'idle' || step === 'uploading' || step === 'extracting') && (
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
                <Badge variant="outline" className="text-xs">{getFileCategory(file.name).toUpperCase()}</Badge>
              </div>
            )}
            {progress && (
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                {progress}
              </div>
            )}
            <Button
              onClick={handleImport}
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing with AI...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Extract & Preview Leads</>
              )}
            </Button>
          </div>
        )}

        {/* Step: preview */}
        {step === 'preview' && previewLeads.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{previewLeads.length} leads extracted</p>
                <p className="text-xs text-slate-500">{selectedIds.size} selected for import</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedIds.size === previewLeads.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left w-8">
                      <input type="checkbox" checked={selectedIds.size === previewLeads.length} onChange={toggleAll} />
                    </th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Company</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Phone</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Email</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLeads.map(lead => (
                    <tr key={lead._id} className={`border-t border-slate-100 hover:bg-slate-50 ${!selectedIds.has(lead._id) ? 'opacity-40' : ''}`}>
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={selectedIds.has(lead._id)} onChange={() => toggleSelect(lead._id)} />
                      </td>
                      <td className="px-2 py-1.5 font-medium text-slate-800 max-w-[120px] truncate">{lead.company_name}</td>
                      <td className="px-2 py-1.5 text-slate-500">{lead.phone || <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[120px] truncate">{lead.email || <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate">{lead.location || <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleConfirmImport}
                disabled={selectedIds.size === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Import {selectedIds.size} Lead{selectedIds.size !== 1 ? "s" : ""}
              </Button>
              <Button variant="outline" onClick={() => { setStep('idle'); setPreviewLeads([]); setFile(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: importing */}
        {step === 'importing' && (
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-3">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            {progress}
          </div>
        )}

        {step === 'done' && (
          <Button variant="outline" className="w-full" onClick={() => { setStep('idle'); setMessage(null); }}>
            Import Another File
          </Button>
        )}

        {step === 'idle' && (
          <div className="pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-600">Supported:</strong> CSV, Excel (XLSX/XLS), PDF, Word (DOC/DOCX), PowerPoint, HTML, TXT, JSON
            </p>
            <p className="text-xs text-slate-400 mt-1">
              AI analyzes any column structure automatically and maps data to lead fields.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}