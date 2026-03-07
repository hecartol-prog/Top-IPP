import React, { useState } from "react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle2, FileText, AlertCircle, Check, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ACCEPTED_TYPES = ".csv,.xlsx,.xls";

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

function getCol(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) {
      const v = cleanValue(row[k]);
      if (v) return v;
    }
    // try trimmed
    const t = k.trim();
    if (row[t] !== undefined && row[t] !== null) {
      const v = cleanValue(row[t]);
      if (v) return v;
    }
  }
  return "";
}

function rowToLead(row) {
  const company = getCol(row,
    "COMPANY ", "COMPANY", "EMPRESA", "RAZON SOCIAL", "NOMBRE", "NAME", "COMPANY NAME"
  );
  if (!company) return null;

  // Only use dedicated contact columns for person name — never split company name
  const contactName = getCol(row,
    "CONTACT", "CONTACTO", "PERSON", "PERSONA", "REPRESENTATIVE", "REPRESENTANTE", "CONTACT PERSON", "NOMBRE CONTACTO"
  );
  let firstName = "", lastName = "";
  if (contactName && contactName.toLowerCase() !== company.toLowerCase()) {
    const parts = contactName.split(" ").filter(Boolean);
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ") || "";
  }

  const phone = getCol(row, "PHONE", "TELEFONO", "TEL", "CELULAR", "MOBILE");
  const email = getCol(row, "EMAIL", "CORREO", "E-MAIL", "MAIL");
  const state = getCol(row, "STATE", "ESTADO");
  const city = getCol(row, "CITY", "CIUDAD");
  const location = [city, state].filter(Boolean).join(", ");
  const industry = getCol(row, "FIELD", "GIRO", "ACTIVIDAD", "SECTOR", "INDUSTRIA", "RAMO");
  const empRaw = getCol(row,
    "No. OF EMPLOYEEES", "No. OF EMPLOYEES", "EMPLEADOS", "TRABAJADORES", "EMPLOYEES", "No. OF EMPLOYEEES"
  );
  const address = getCol(row, "ADDRESS", "DOMICILIO", "CALLE", "DIRECCION");
  const town = getCol(row, "TOWN", "COLONIA", "MUNICIPIO");
  const notes = [address, town].filter(Boolean).join(", ");

  return {
    first_name: firstName,
    last_name: lastName,
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

function parseFileToRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Detect if the file uses a multi-row-per-company format
// (e.g. Uruguay: company name, then Contacto:, Dirección:, Tel:, etc. on successive rows)
function isMultiRowFormat(rows) {
  if (!rows || rows.length < 3) return false;
  const col = Object.keys(rows[0] || {})[1] || Object.keys(rows[0] || {})[0];
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
function parseMultiRowFormat(rows) {
  const companies = [];
  const mainCol = Object.keys(rows[0] || {})[1] || Object.keys(rows[0] || {})[0];
  const prodCol = Object.keys(rows[0] || {})[2];
  const procCol = Object.keys(rows[0] || {})[3];

  let currentBlock = null;

  const saveBlock = (block) => {
    if (!block || !block.company_name) return;
    companies.push(block);
  };

  for (const row of rows) {
    const val = String(row[mainCol] || "").trim();
    const prodVal = String(row[prodCol] || "").trim();
    const procVal = String(row[procCol] || "").trim();
    if (!val && !prodVal && !procVal) continue;

    const lower = val.toLowerCase();

    // New company starts when there's a number in col_0 or the value doesn't start with known prefixes
    const isNewCompany = (row["col_0"] && !isNaN(Number(row["col_0"]))) ||
      (!lower.startsWith("contacto:") && !lower.startsWith("contact:") &&
       !lower.startsWith("tel.:") && !lower.startsWith("tel:") &&
       !lower.startsWith("dirección:") && !lower.startsWith("direccion:") &&
       !lower.startsWith("fax:") && !lower.startsWith("e-mail:") &&
       !lower.startsWith("email:") && !lower.startsWith("web:") &&
       !lower.startsWith("www.") && !lower.startsWith("sitio") &&
       !lower.startsWith("ciudad:") && !lower.startsWith("localidad:") &&
       !lower.startsWith("departamento:") && !lower.startsWith("rut:") &&
       val.length > 3 && !currentBlock);

    if (isNewCompany && !currentBlock) {
      currentBlock = {
        company_name: val,
        contact_name: "",
        address: "",
        phone: "",
        fax: "",
        email: "",
        website: "",
        location: "",
        products: prodVal,
        processes: procVal,
      };
    } else if (isNewCompany && currentBlock) {
      saveBlock(currentBlock);
      currentBlock = {
        company_name: val,
        contact_name: "",
        address: "",
        phone: "",
        fax: "",
        email: "",
        website: "",
        location: "",
        products: prodVal || currentBlock.products,
        processes: procVal || currentBlock.processes,
      };
    } else if (currentBlock) {
      // Parse sub-row fields
      if (lower.startsWith("contacto:") || lower.startsWith("contact:")) {
        currentBlock.contact_name = val.replace(/^contacto:\s*/i, "").replace(/^contact:\s*/i, "").trim();
        // Handle "Contacto: Name / Other Name" format
        if (currentBlock.contact_name.includes("/")) {
          currentBlock.contact_name = currentBlock.contact_name.split("/")[0].trim();
        }
      } else if (lower.startsWith("tel.:") || lower.startsWith("tel:") || lower.startsWith("teléfono:") || lower.startsWith("telefono:")) {
        currentBlock.phone = val.replace(/^tel[eéf\.]+:\s*/i, "").trim();
      } else if (lower.startsWith("fax:")) {
        currentBlock.fax = val.replace(/^fax:\s*/i, "").trim();
      } else if (lower.startsWith("e-mail:") || lower.startsWith("email:") || lower.startsWith("correo:")) {
        currentBlock.email = val.replace(/^(e-mail|email|correo):\s*/i, "").trim();
      } else if (lower.startsWith("web:") || lower.startsWith("www.") || lower.startsWith("sitio")) {
        currentBlock.website = val.replace(/^(web|sitio web|sitio):\s*/i, "").trim();
        if (!currentBlock.website.startsWith("http") && currentBlock.website.startsWith("www")) {
          currentBlock.website = "https://" + currentBlock.website;
        }
      } else if (lower.startsWith("dirección:") || lower.startsWith("direccion:") || lower.startsWith("domicilio:")) {
        currentBlock.address = val.replace(/^(dirección|direccion|domicilio):\s*/i, "").trim();
      } else if (lower.startsWith("ciudad:") || lower.startsWith("localidad:") || lower.startsWith("departamento:")) {
        currentBlock.location = val.replace(/^(ciudad|localidad|departamento):\s*/i, "").trim();
      } else if (prodVal) {
        if (!currentBlock.products) currentBlock.products = prodVal;
      }

      // Supplement products/processes from other columns if present
      if (prodVal && !currentBlock.products) currentBlock.products = prodVal;
      if (procVal && !currentBlock.processes) currentBlock.processes = procVal;
    }
  }

  if (currentBlock) saveBlock(currentBlock);
  return companies;
}

function multiRowBlockToLead(block) {
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
  };
}

export default function LeadCSVImport({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("idle");
  const [message, setMessage] = useState(null);
  const [previewLeads, setPreviewLeads] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [progress, setProgress] = useState("");
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
    setProgress(`Mapping ${rows.length} rows...`);

    let leads;
    if (isMultiRowFormat(rows)) {
      setProgress("Detected multi-row company format. Parsing blocks...");
      const blocks = parseMultiRowFormat(rows);
      leads = blocks.map(multiRowBlockToLead).filter(Boolean);
    } else {
      leads = rows.map(rowToLead).filter(Boolean);
    }

    if (leads.length === 0) {
      setMessage({ type: "error", text: "No leads found. Please check the file format." });
      setStep("idle");
      setProgress("");
      return;
    }

    const indexed = leads.map((l, i) => ({ ...l, _id: i }));
    setPreviewLeads(indexed);
    setSelectedIds(new Set(indexed.map(l => l._id)));
    setStep("preview");
    setProgress("");
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