import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle2, FileText, AlertCircle, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ACCEPTED_TYPES = ".csv,.xlsx,.xls,.pdf,.doc,.docx,.json,.txt,.html,.htm";

const COMPANY_SIZE_MAP = [
  ["0 a 10", "1-10"], ["1 a 10", "1-10"], ["1-10", "1-10"], ["0-10", "1-10"],
  ["11 a 50", "11-50"], ["11-50", "11-50"],
  ["51 a 250", "51-200"], ["51 a 200", "51-200"], ["51-200", "51-200"],
  ["201 a 500", "201-500"], ["251 a 500", "201-500"], ["201-500", "201-500"],
  ["501 a 1000", "501-1000"], ["501-1000", "501-1000"],
  ["1001", "1000+"], ["1000+", "1000+"],
];

function normalizeCompanySize(raw) {
  if (!raw) return "";
  const s = String(raw).trim().toLowerCase();
  for (const [key, val] of COMPANY_SIZE_MAP) {
    if (s.includes(key.toLowerCase())) return val;
  }
  return "";
}

function cleanValue(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (["sin dato", "n/a", "na", "-", "0"].includes(s.toLowerCase())) return "";
  return s;
}

// Try to find a column value using multiple possible header names
function getCol(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return cleanValue(row[k]);
    // also try trimmed key
    const trimmed = k.trim();
    if (row[trimmed] !== undefined && row[trimmed] !== null) return cleanValue(row[trimmed]);
  }
  return "";
}

function rowToLead(row) {
  const company = getCol(row, "COMPANY ", "COMPANY", "EMPRESA", "RAZON SOCIAL", "NOMBRE", "NAME");
  if (!company) return null;

  const phone = getCol(row, "PHONE", "TELEFONO", "TEL", "CELULAR", "MOBILE");
  const email = getCol(row, "EMAIL", "CORREO", "E-MAIL", "MAIL");
  const state = getCol(row, "STATE", "ESTADO");
  const city = getCol(row, "CITY", "CIUDAD");
  const location = [city, state].filter(Boolean).join(", ");
  const industry = getCol(row, "FIELD", "GIRO", "ACTIVIDAD", "SECTOR", "INDUSTRIA", "RAMO");
  const empRaw = getCol(row, "No. OF EMPLOYEEES", "No. OF EMPLOYEES", "EMPLEADOS", "TRABAJADORES", "EMPLOYEES");
  const address = getCol(row, "ADDRESS", "DOMICILIO", "CALLE", "DIRECCION");
  const town = getCol(row, "TOWN", "COLONIA", "MUNICIPIO");
  const notes = [address, town].filter(Boolean).join(", ");

  return {
    first_name: company.split(" ")[0] || "Unknown",
    last_name: "",
    email: email.includes("@") ? email : "",
    phone: /\d{5,}/.test(phone) ? phone : "",
    job_title: "",
    company_name: company,
    company_size: normalizeCompanySize(empRaw),
    industry,
    website: "",
    location,
    notes,
    status: "new",
    source: "other",
  };
}

export default function LeadCSVImport({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("idle");
  const [message, setMessage] = useState(null);
  const [previewLeads, setPreviewLeads] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [progress, setProgress] = useState("");

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setMessage(null); setStep("idle"); setPreviewLeads([]); }
  };

  const handleExtract = async () => {
    if (!file) return;
    setStep("extracting");
    setProgress("Uploading file...");
    setMessage(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProgress("Extracting data...");

    const ext = file.name.split(".").pop().toLowerCase();
    let leads = [];

    if (["xlsx", "xls", "csv"].includes(ext)) {
      // Direct structured extraction — fast and reliable for tabular files
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "No.": { type: "number" },
              "COMPANY ": { type: "string" },
              "COMPANY": { type: "string" },
              "STATE": { type: "string" },
              "CITY": { type: "string" },
              "ADDRESS": { type: "string" },
              "TOWN": { type: "string" },
              "ZP": { type: "string" },
              "PHONE": { type: "string" },
              "EMAIL": { type: "string" },
              "FIELD": { type: "string" },
              "No. OF EMPLOYEEES": { type: "string" },
              "No. OF EMPLOYEES": { type: "string" },
              "REGISTRY AT": { type: "string" },
              // Spanish variants
              "EMPRESA": { type: "string" },
              "ESTADO": { type: "string" },
              "CIUDAD": { type: "string" },
              "TELEFONO": { type: "string" },
              "CORREO": { type: "string" },
              "GIRO": { type: "string" },
              "EMPLEADOS": { type: "string" },
            }
          }
        }
      });

      if (result.status === "success" && Array.isArray(result.output)) {
        leads = result.output.map(rowToLead).filter(Boolean);
      }
    }

    // Fallback: AI-based extraction for non-tabular or if direct extraction returned nothing
    if (leads.length === 0) {
      setProgress("Using AI to parse file...");
      const aiResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract ALL company/contact records from this file as leads. 
Return a JSON object with a "leads" array. Each lead must have:
company_name, phone, email, location (city + state), industry, company_size (use: "1-10","11-50","51-200","201-500","501-1000","1000+"), notes (address).
Skip rows with no company name. Clean "sin dato" values to empty string.`,
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
                  company_name: { type: "string" },
                  company_size: { type: "string" },
                  industry: { type: "string" },
                  location: { type: "string" },
                  notes: { type: "string" },
                }
              }
            }
          }
        }
      });
      leads = (aiResult?.leads || []).map(l => ({
        first_name: cleanValue(l.first_name) || (l.company_name || "").split(" ")[0] || "Unknown",
        last_name: cleanValue(l.last_name) || "",
        email: cleanValue(l.email),
        phone: cleanValue(l.phone),
        job_title: "",
        company_name: cleanValue(l.company_name),
        company_size: normalizeCompanySize(l.company_size) || cleanValue(l.company_size),
        industry: cleanValue(l.industry),
        website: "",
        location: cleanValue(l.location),
        notes: cleanValue(l.notes),
        status: "new",
        source: "other",
      })).filter(l => l.company_name);
    }

    if (leads.length === 0) {
      setMessage({ type: "error", text: "No leads found. Please check the file content." });
      setStep("idle");
      return;
    }

    const indexed = leads.map((l, i) => ({ ...l, _id: i }));
    setPreviewLeads(indexed);
    setSelectedIds(new Set(indexed.map(l => l._id)));
    setStep("preview");
    setProgress("");
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === previewLeads.length ? new Set() : new Set(previewLeads.map(l => l._id)));

  const handleConfirmImport = async () => {
    const toImport = previewLeads.filter(l => selectedIds.has(l._id));
    setStep("importing");
    let imported = 0;
    const batchSize = 20;
    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize);
      await Promise.all(batch.map(({ _id, ...data }) => base44.entities.Lead.create(data)));
      imported += batch.length;
      setProgress(`Importing... ${imported}/${toImport.length}`);
    }
    setStep("done");
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
          <Alert className={message.type === "success" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}>
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 inline mr-2 text-emerald-600" /> : <AlertCircle className="w-4 h-4 inline mr-2 text-red-600" />}
            <AlertDescription className={message.type === "success" ? "text-emerald-800" : "text-red-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {(step === "idle" || step === "extracting") && (
          <div className="space-y-3">
            <Input type="file" accept={ACCEPTED_TYPES} onChange={handleFileChange} disabled={step === "extracting"} />
            {file && (
              <div className="text-sm text-slate-600 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {file.name}
                <Badge variant="outline" className="text-xs">{file.name.split(".").pop().toUpperCase()}</Badge>
              </div>
            )}
            {progress && (
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                {progress}
              </div>
            )}
            <Button onClick={handleExtract} disabled={!file || step === "extracting"} className="w-full">
              {step === "extracting" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Extracting leads...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Extract & Preview Leads</>
              )}
            </Button>
            {step === "idle" && (
              <p className="text-xs text-slate-400">
                Supports: CSV, Excel (XLSX/XLS), PDF, Word, HTML, TXT, JSON
              </p>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{previewLeads.length} leads found</p>
                <p className="text-xs text-slate-500">{selectedIds.size} selected for import</p>
              </div>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedIds.size === previewLeads.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
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
                    <tr key={lead._id} className={`border-t border-slate-100 hover:bg-slate-50 ${!selectedIds.has(lead._id) ? "opacity-40" : ""}`}>
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={selectedIds.has(lead._id)} onChange={() => toggleSelect(lead._id)} />
                      </td>
                      <td className="px-2 py-1.5 font-medium text-slate-800 max-w-[140px] truncate">{lead.company_name}</td>
                      <td className="px-2 py-1.5 text-slate-500">{lead.phone || <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[130px] truncate">{lead.email || <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate">{lead.location || <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleConfirmImport} disabled={selectedIds.size === 0} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <Check className="w-4 h-4 mr-2" />
                Import {selectedIds.size} Lead{selectedIds.size !== 1 ? "s" : ""}
              </Button>
              <Button variant="outline" onClick={() => { setStep("idle"); setPreviewLeads([]); setFile(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-3">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            {progress}
          </div>
        )}

        {step === "done" && (
          <Button variant="outline" className="w-full" onClick={() => { setStep("idle"); setMessage(null); }}>
            Import Another File
          </Button>
        )}
      </CardContent>
    </Card>
  );
}