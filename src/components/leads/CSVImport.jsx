import React, { useState } from "react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle2, FileText, AlertCircle, Check, X, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ACCEPTED_TYPES = ".csv,.xlsx,.xls";

function cleanValue(val) {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (["sin dato", "n/a", "na", "-", "0", ""].includes(s.toLowerCase())) return "";
  return s;
}

function normalizeCompanySize(raw) {
  if (!raw) return "";
  const s = String(raw).replace(/[,\s]/g, "").toLowerCase();
  const n = parseInt(s);
  if (!isNaN(n)) {
    if (n <= 10) return "1-10";
    if (n <= 50) return "11-50";
    if (n <= 200) return "51-200";
    if (n <= 500) return "201-500";
    if (n <= 1000) return "501-1000";
    return "1000+";
  }
  const ranges = [["1-10","1-10"],["11-50","11-50"],["51-200","51-200"],["51-250","51-200"],
    ["201-500","201-500"],["501-1000","501-1000"],["1000+","1000+"]];
  for (const [k, v] of ranges) { if (s.includes(k.toLowerCase())) return v; }
  return "";
}

// AI-powered column detection: send headers + sample rows, get back field mapping
async function detectColumnMapping(rows) {
  const headers = Object.keys(rows[0] || {});
  const sample = rows.slice(0, 5);

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are analyzing a spreadsheet of B2B business leads/companies for a plastic injection mold manufacturer.

Column headers found: ${JSON.stringify(headers)}

Sample data rows (first 5):
${JSON.stringify(sample, null, 2)}

Map each column header to exactly one of these lead fields:
- "company_name" — company/business/organization name
- "contact_full_name" — full name of contact person (will be split into first/last)
- "first_name" — contact first name only
- "last_name" — contact last name only
- "email" — email address
- "phone" — phone, mobile, tel number
- "job_title" — job title, position, role, cargo
- "website" — website, web, URL
- "industry" — industry, sector, field, giro, actividad
- "company_size" — employee count, company size, número empleados
- "city" — city, ciudad
- "state" — state, province, estado
- "country" — country, país
- "location" — full location/address combining city+state+region
- "notes" — notes, comments, description, why they need molds, additional info
- "priority" — priority level
- "skip" — column doesn't map to any lead field

Also detect the file format:
- "flat_rows": standard table where each row is one company/lead
- "card_blocks": companies appear in groups/blocks of rows (label: value style), each block is one company
- "mixed": uncertain

Return a JSON with column_map (object mapping each header string to a field name) and format ("flat_rows", "card_blocks", or "mixed").`,
    response_json_schema: {
      type: "object",
      properties: {
        column_map: { type: "object", additionalProperties: { type: "string" } },
        format: { type: "string" }
      }
    }
  });

  return result || { column_map: {}, format: "flat_rows" };
}

// Apply AI-detected mapping to a single row
function applyMappingToRow(row, columnMap, defaultCountry, defaultLanguage) {
  const get = (field) => {
    for (const [col, mapped] of Object.entries(columnMap)) {
      if (mapped === field) {
        const v = cleanValue(row[col]);
        if (v) return v;
      }
    }
    return "";
  };

  const companyName = get("company_name");
  if (!companyName) return null;

  // Contact name
  let firstName = get("first_name");
  let lastName = get("last_name");
  if (!firstName && !lastName) {
    const full = get("contact_full_name");
    if (full && full.toLowerCase() !== companyName.toLowerCase()) {
      const parts = full.trim().split(/\s+/).filter(Boolean);
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }
  }

  const city = get("city");
  const state = get("state");
  const country = get("country") || defaultCountry;
  const locationField = get("location");
  const location = locationField || [city, state, country].filter(Boolean).join(", ");

  const priorityRaw = get("priority").toUpperCase();
  const priorityMap = { HIGH: "high", MEDIUM: "medium", LOW: "low", URGENT: "urgent", ALTO: "high", MEDIO: "medium", BAJO: "low" };
  const priority = priorityMap[priorityRaw] || "medium";

  const email = get("email");
  const phone = get("phone");

  return {
    first_name: firstName,
    last_name: lastName,
    email: email.includes("@") ? email : "",
    phone: /\d{4,}/.test(phone) ? phone : "",
    job_title: get("job_title"),
    company_name: companyName,
    company_size: normalizeCompanySize(get("company_size")),
    industry: get("industry"),
    website: get("website"),
    location,
    country,
    notes: get("notes").slice(0, 500),
    status: "new",
    source: "other",
    priority,
    language: defaultLanguage || "english",
  };
}

function parseFileToRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        // Find sheet with most data
        let sheetName = workbook.SheetNames[0];
        let maxRows = 0;
        for (const name of workbook.SheetNames) {
          const r = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "" });
          if (r.length > maxRows) { maxRows = r.length; sheetName = name; }
        }
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        // Keep original keys — AI will interpret them
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// For card/block formats: ask AI to parse all blocks and extract leads directly
async function extractCardBlocks(rows, columnMap, defaultCountry, defaultLanguage, setProgress) {
  // Chunk rows into batches of 30 and extract all leads via LLM
  const chunkSize = 30;
  const allLeads = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    setProgress(`Extracting card blocks... ${Math.min(i + chunkSize, rows.length)}/${rows.length} rows`);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `These rows come from a spreadsheet where companies appear as grouped blocks (card format), not one-per-row.
Each block of rows represents one company. Extract all companies from this data.

Raw rows:
${JSON.stringify(chunk, null, 2)}

For each company found, extract all available fields. Return as an array of leads.
For company_size, use one of: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+".
For priority, use: "low", "medium", "high", "urgent".`,
        response_json_schema: {
          type: "object",
          properties: {
            leads: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company_name: { type: "string" },
                  first_name: { type: "string" },
                  last_name: { type: "string" },
                  job_title: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  website: { type: "string" },
                  industry: { type: "string" },
                  location: { type: "string" },
                  company_size: { type: "string" },
                  notes: { type: "string" },
                  priority: { type: "string" },
                }
              }
            }
          }
        }
      });
      for (const lead of (result?.leads || [])) {
        if (lead.company_name) {
          allLeads.push({
            ...lead,
            email: (lead.email || "").includes("@") ? lead.email : "",
            phone: /\d{4,}/.test(lead.phone || "") ? lead.phone : "",
            status: "new",
            source: "other",
            country: lead.country || defaultCountry,
            language: defaultLanguage || "english",
            notes: (lead.notes || "").slice(0, 500),
            priority: ["low","medium","high","urgent"].includes(lead.priority) ? lead.priority : "medium",
          });
        }
      }
    } catch (e) {
      // skip failed chunk
    }
  }
  return allLeads;
}

// Detect if the file uses a multi-row-per-company format
function isMultiRowFormat(rows) {
  if (!rows || rows.length < 3) return false;
  const keys = Object.keys(rows[0] || {});
  // If headers include "COMPANY" / "DECISION CONTACT" etc., it's a flat format
  if (keys.some(k => ["COMPANY", "DECISION CONTACT", "EMAIL", "PHONE", "WEBSITE"].includes(k))) return false;
  const col = keys[1] || keys[0];
  let multiRowCount = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const val = String(rows[i][col] || "").toLowerCase().trim();
    if (val.startsWith("contacto:") || val.startsWith("tel.:") || val.startsWith("tel:") ||
        val.startsWith("dirección:") || val.startsWith("direccion:") || val.startsWith("fax:") ||
        val.startsWith("e-mail:") || val.startsWith("email:") || val.startsWith("web:") ||
        val.startsWith("www.") || val.startsWith("sitio")) {
      multiRowCount++;
    }
  }
  return multiRowCount >= 2;
}

// Parse multi-row format: group rows into company blocks then extract fields from each block
// A new company block starts when col_0 has a number value
function parseMultiRowFormat(rows) {
  const companies = [];
  // Column names from this file format
  const col0 = Object.keys(rows[0] || {})[0]; // e.g. "col_0" or ""
  const mainCol = Object.keys(rows[0] || {})[1]; // EMPRESA
  const prodCol = Object.keys(rows[0] || {})[2]; // PRODUCTOS QUE FABRICA
  const procCol = Object.keys(rows[0] || {})[3]; // PROCESOS DE FABRICACIÓN

  let currentBlock = null;

  const saveBlock = (block) => {
    if (block && block.company_name) companies.push(block);
  };

  for (const row of rows) {
    const idVal = row[col0];
    const val = String(row[mainCol] || "").trim();
    const prodVal = String(row[prodCol] || "").trim();
    const procVal = String(row[procCol] || "").trim();

    // A new company starts when the first column has a numeric value
    const isNewCompany = idVal !== "" && idVal !== null && idVal !== undefined && !isNaN(Number(idVal));

    if (isNewCompany) {
      saveBlock(currentBlock);
      currentBlock = {
        company_name: val,
        contact_name: "",
        address: "",
        phone: "",
        email: "",
        website: "",
        products: prodVal,
        processes: procVal,
      };
      continue;
    }

    if (!currentBlock) continue;

    // Parse sub-row: detect field by prefix in the EMPRESA column
    const lower = val.toLowerCase();

    if (lower.startsWith("contacto:") || lower.startsWith("contact:")) {
      let name = val.replace(/^contacto:\s*/i, "").replace(/^contact:\s*/i, "").trim();
      if (name.includes("/")) name = name.split("/")[0].trim();
      currentBlock.contact_name = name;

    } else if (lower.startsWith("tel.:") || lower.startsWith("tel:") || lower.startsWith("teléfono:") || lower.startsWith("telefono:")) {
      currentBlock.phone = val.replace(/^tel[eéfon\.y ]+:\s*/i, "").trim();

    } else if (lower.startsWith("fax:")) {
      // ignore fax

    } else if (lower.startsWith("mail:") || lower.startsWith("e-mail:") || lower.startsWith("email:") || lower.startsWith("correo:")) {
      // Extract email — may contain multiple emails and a web inline
      let rest = val.replace(/^(mail|e-mail|email|correo):\s*/i, "").trim();
      // Sometimes "Web: ..." is appended inline
      const webInline = rest.match(/web:\s*([\w.\-/]+)/i);
      if (webInline && !currentBlock.website) {
        currentBlock.website = webInline[1].trim();
        rest = rest.replace(/web:\s*[\w.\-/]+/i, "").trim();
      }
      // Take first email address
      const emailMatch = rest.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
      if (emailMatch) currentBlock.email = emailMatch[0];

    } else if (lower.startsWith("web:") || lower.startsWith("www.")) {
      currentBlock.website = val.replace(/^web:\s*/i, "").trim();

    } else if (lower.startsWith("dirección:") || lower.startsWith("direccion:") || lower.startsWith("domicilio:")) {
      currentBlock.address = val.replace(/^(dirección|direccion|domicilio):\s*/i, "").trim();
    }

    // Accumulate products/processes from other columns
    if (prodVal && !currentBlock.products) currentBlock.products = prodVal;
    else if (prodVal && currentBlock.products && !currentBlock.products.includes(prodVal)) {
      currentBlock.products += " | " + prodVal;
    }
    if (procVal && !currentBlock.processes) currentBlock.processes = procVal;
  }

  saveBlock(currentBlock);
  return companies;
}

function multiRowBlockToLead(block, country = "", language = "spanish") {
  if (!block.company_name) return null;
  const contactParts = (block.contact_name || "").split(" ").filter(Boolean);
  return {
    first_name: contactParts[0] || "",
    last_name: contactParts.slice(1).join(" ") || "",
    email: (block.email || "").includes("@") ? block.email : "",
    phone: /\d{4,}/.test(block.phone) ? block.phone : "",
    job_title: "",
    company_name: block.company_name.replace(/\s+/g, " ").trim(),
    website: block.website || "",
    location: block.location || block.address || "",
    notes: [block.address, block.products, block.processes].filter(Boolean).join(" | ").slice(0, 300),
    industry: block.processes || "",
    status: "new",
    source: "other",
    company_size: "",
    country,
    language,
  };
}

export default function LeadCSVImport({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("idle");
  const [message, setMessage] = useState(null);
  const [previewLeads, setPreviewLeads] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [progress, setProgress] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("english");
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState("");
  const [enrichingContacts, setEnrichingContacts] = useState(false);
  const [enrichContactProgress, setEnrichContactProgress] = useState("");

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setMessage(null); setStep("idle"); setPreviewLeads([]); }
  };

  const handleExtract = async () => {
    if (!file) return;
    setStep("extracting");
    setProgress("Reading file...");
    setMessage(null);

    const rows = await parseFileToRows(file);
    if (rows.length === 0) {
      setMessage({ type: "error", text: "File appears empty." });
      setStep("idle");
      setProgress("");
      return;
    }

    setProgress(`Analyzing column structure with AI (${rows.length} rows)...`);

    let mapping;
    try {
      mapping = await detectColumnMapping(rows);
    } catch (e) {
      setMessage({ type: "error", text: `AI column detection failed: ${e.message}` });
      setStep("idle");
      setProgress("");
      return;
    }

    setProgress(`Mapping detected. Extracting leads...`);

    let leads;
    if (mapping.format === "card_blocks") {
      // For card/block formats, fall back to LLM-based block extraction
      leads = await extractCardBlocks(rows, mapping.column_map, country, language, setProgress);
    } else {
      leads = rows
        .map(row => applyMappingToRow(row, mapping.column_map, country, language))
        .filter(Boolean);
    }

    if (leads.length === 0) {
      setMessage({ type: "error", text: "No leads could be extracted. The AI could not find company names in this file." });
      setStep("idle");
      setProgress("");
      return;
    }

    const indexed = leads.map((l, i) => ({ ...l, _id: i }));
    setPreviewLeads(indexed);
    setSelectedIds(new Set(indexed.map(l => l._id)));
    setStep("preview");
    setProgress("");
    setMessage({ type: "success", text: `Found ${leads.length} leads. Format: ${mapping.format}.` });
  };

  const handleEnrichWebsites = async () => {
    const companiesWithoutWebsite = previewLeads
      .filter(l => selectedIds.has(l._id) && !l.website)
      .map(l => l.company_name);

    if (companiesWithoutWebsite.length === 0) return;

    setEnriching(true);
    setEnrichProgress(`Searching websites for ${companiesWithoutWebsite.length} companies...`);

    try {
      // Process in batches of 10 to avoid timeouts
      const batchSize = 10;
      const allResults = {};
      for (let i = 0; i < companiesWithoutWebsite.length; i += batchSize) {
        const batch = companiesWithoutWebsite.slice(i, i + batchSize);
        setEnrichProgress(`Searching websites... ${Math.min(i + batchSize, companiesWithoutWebsite.length)}/${companiesWithoutWebsite.length}`);
        const res = await base44.functions.invoke("apifyWebsiteSearch", { companies: batch });
        Object.assign(allResults, res.data?.results || {});
      }

      setPreviewLeads(prev => prev.map(l => ({
        ...l,
        website: allResults[l.company_name] || l.website || "",
      })));
      setEnrichProgress(`Done! Found websites for ${Object.values(allResults).filter(Boolean).length} companies.`);
    } catch (e) {
      setEnrichProgress(`Website search failed: ${e.message}`);
    }
    setEnriching(false);
  };

  const handleEnrichContacts = async () => {
    const leadsWithWebsite = previewLeads.filter(
      l => selectedIds.has(l._id) && l.website && (!l.email || !l.phone)
    );

    if (leadsWithWebsite.length === 0) {
      setEnrichContactProgress("No leads with websites to enrich. Run website search first.");
      return;
    }

    setEnrichingContacts(true);
    setEnrichContactProgress(`Scraping ${leadsWithWebsite.length} company websites for contacts...`);

    let found = 0;
    for (let i = 0; i < leadsWithWebsite.length; i++) {
      const lead = leadsWithWebsite[i];
      setEnrichContactProgress(`Scraping websites... ${i + 1}/${leadsWithWebsite.length}: ${lead.company_name}`);
      try {
        const res = await base44.functions.invoke("apifyEnrichCompany", {
          company: lead.company_name,
          website: lead.website,
        });
        const enriched = res.data?.enriched;
        if (enriched) {
          const gotSomething = (enriched.email && !lead.email) || (enriched.phone && !lead.phone);
          if (gotSomething) found++;
          setPreviewLeads(prev => prev.map(l => l._id === lead._id ? {
            ...l,
            email: l.email || enriched.email || "",
            phone: l.phone || enriched.phone || "",
            notes: l.notes || (enriched.description ? enriched.description.slice(0, 200) : ""),
          } : l));
        }
      } catch (e) {
        // skip failed
      }
    }

    setEnrichContactProgress(`Done! Enriched contact data for ${found} companies.`);
    setEnrichingContacts(false);
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () =>
    setSelectedIds(selectedIds.size === previewLeads.length ? new Set() : new Set(previewLeads.map(l => l._id)));

  const handleConfirmImport = async () => {
    const toImport = previewLeads.filter(l => selectedIds.has(l._id)).map(({ _id, ...data }) => data);
    setStep("importing");
    let imported = 0;
    const batchSize = 50;
    for (let i = 0; i < toImport.length; i += batchSize) {
      const batch = toImport.slice(i, i + batchSize);
      setProgress(`Importing... ${Math.min(i + batchSize, toImport.length)}/${toImport.length}`);
      await base44.entities.Lead.bulkCreate(batch);
      imported += batch.length;
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
            {message.type === "success"
              ? <CheckCircle2 className="w-4 h-4 inline mr-2 text-emerald-600" />
              : <AlertCircle className="w-4 h-4 inline mr-2 text-red-600" />}
            <AlertDescription className={message.type === "success" ? "text-emerald-800" : "text-red-800"}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        {(step === "idle" || step === "extracting") && (
          <div className="space-y-3">
            <Input type="file" accept={ACCEPTED_TYPES} onChange={handleFileChange} disabled={step === "extracting"} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Country</Label>
                <Input
                  placeholder="e.g. Uruguay, USA"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  disabled={step === "extracting"}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Language</Label>
                <Select value={language} onValueChange={setLanguage} disabled={step === "extracting"}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="portuguese">Portuguese</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reading file...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Extract & Preview Leads</>
              )}
            </Button>
            <p className="text-xs text-slate-400">Supports: CSV, Excel (XLSX/XLS)</p>
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
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Contact</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Email</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Phone</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Industry</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-600">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLeads.map(lead => (
                    <tr key={lead._id} className={`border-t border-slate-100 hover:bg-slate-50 ${!selectedIds.has(lead._id) ? "opacity-40" : ""}`}>
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={selectedIds.has(lead._id)} onChange={() => toggleSelect(lead._id)} />
                      </td>
                      <td className="px-2 py-1.5 font-medium text-slate-800 max-w-[130px] truncate">{lead.company_name}</td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate">{[lead.first_name, lead.last_name].filter(Boolean).join(" ") || <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[120px] truncate">{lead.email || <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-500">{lead.phone || <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-500 max-w-[100px] truncate">{lead.industry || <span className="text-slate-300">—</span>}</td>
                      <td className="px-2 py-1.5 text-slate-500">{lead.priority || <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {enrichProgress && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${enriching ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-600"}`}>
                {enriching && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                {enrichProgress}
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleEnrichWebsites}
              disabled={enriching || enrichingContacts}
              className="w-full text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              {enriching ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching websites...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" />Step 1: Find Websites via Apify</>
              )}
            </Button>

            {enrichContactProgress && (
              <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${enrichingContacts ? "bg-purple-50 text-purple-700" : "bg-slate-50 text-slate-600"}`}>
                {enrichingContacts && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                {enrichContactProgress}
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleEnrichContacts}
              disabled={enriching || enrichingContacts}
              className="w-full text-purple-700 border-purple-200 hover:bg-purple-50"
            >
              {enrichingContacts ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scraping contact info...</>
              ) : (
                <><Search className="w-4 h-4 mr-2" />Step 2: Scrape Emails & Phones from Websites</>
              )}
            </Button>

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