import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import {
  Search, RefreshCw, Mail, Globe, Copy, Check,
  ShieldCheck, User, Building2, CheckCircle, XCircle, AlertCircle
} from "lucide-react";

function ScoreBadge({ score }) {
  if (score == null) return null;
  const color = score >= 80 ? "bg-emerald-100 text-emerald-700"
    : score >= 50 ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${color}`}>{score}%</span>;
}

function StatusIcon({ status }) {
  if (status === "valid")   return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  if (status === "invalid") return <XCircle className="w-4 h-4 text-rose-500" />;
  return <AlertCircle className="w-4 h-4 text-amber-500" />;
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={handle} className="text-slate-400 hover:text-slate-700 p-1 shrink-0">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-slate-800 break-all flex-1">{value}</span>
      <CopyBtn text={value} />
    </div>
  );
}

export default function HunterPanel({ lead, onApplyEmail, onApplyLead }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Finder state
  const [domain, setDomain] = useState(
    lead?.website ? lead.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : ''
  );

  // Verify / Combined state — pre-fill with existing email
  const [emailInput, setEmailInput] = useState(lead?.email || '');

  const call = async (payload) => {
    setLoading(true);
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke('hunterEmailFinder', payload);
    if (res.data?.error) setError(res.data.error);
    else setResult(res.data);
    setLoading(false);
  };

  const handleFinder = () => call({
    mode: 'finder', domain,
    first_name: lead?.first_name, last_name: lead?.last_name
  });

  const handleDomainSearch = () => call({ domain });

  const handleVerify = () => call({ mode: 'verify', email: emailInput });

  const handleCombined = () => call({ mode: 'combined', email: emailInput });

  const applyEmail = (email) => onApplyEmail && onApplyEmail(email);

  const applyCombined = () => {
    if (!result || result.mode !== 'combined' || !onApplyLead) return;
    const p = result.person;
    const c = result.company;
    const updates = {};
    if (p.email)     updates.email     = p.email;
    if (p.job_title) updates.job_title = p.job_title;
    if (p.phone)     updates.phone     = p.phone;
    if (p.linkedin)  updates.linkedin_url = p.linkedin;
    if (p.location)  updates.location  = p.location;
    if (c.industry)  updates.industry  = c.industry;
    if (c.website)   updates.website   = c.website;
    if (c.size)      updates.company_size = String(c.size);
    onApplyLead(updates);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center shrink-0">
          <Search className="w-3.5 h-3.5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Hunter.io</h3>
          <p className="text-xs text-slate-400">Find, verify & enrich email addresses</p>
        </div>
      </div>

      <Tabs defaultValue="finder">
        <TabsList className="w-full grid grid-cols-4 h-8 text-xs">
          <TabsTrigger value="finder" className="text-xs">Find</TabsTrigger>
          <TabsTrigger value="domain" className="text-xs">Domain</TabsTrigger>
          <TabsTrigger value="verify" className="text-xs">Verify</TabsTrigger>
          <TabsTrigger value="combined" className="text-xs">Enrich</TabsTrigger>
        </TabsList>

        {/* FINDER */}
        <TabsContent value="finder" className="space-y-3 mt-3">
          <p className="text-xs text-slate-500">Find the email for <strong>{lead?.first_name} {lead?.last_name}</strong> using their company domain.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="acme.com" className="pl-9 h-8 text-sm" />
            </div>
            <Button onClick={handleFinder} disabled={loading || !domain || !lead?.first_name} size="sm" className="bg-orange-500 hover:bg-orange-600 shrink-0">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </Button>
          </div>
          {result?.mode === 'finder' && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-2">
              {result.email ? (
                <>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="font-semibold text-slate-800 flex-1">{result.email}</span>
                    <ScoreBadge score={result.score} />
                    <CopyBtn text={result.email} />
                  </div>
                  {result.position && <p className="text-xs text-slate-500">Position: {result.position}</p>}
                  {result.sources?.length > 0 && <p className="text-xs text-slate-400">Sources: {result.sources.join(', ')}</p>}
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" onClick={() => applyEmail(result.email)}>
                    <Check className="w-3 h-3 mr-1" /> Apply Email to Lead
                  </Button>
                </>
              ) : (
                <p className="text-sm text-slate-500">No email found for this person at {domain}.</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* DOMAIN SEARCH */}
        <TabsContent value="domain" className="space-y-3 mt-3">
          <p className="text-xs text-slate-500">List all known emails at a domain.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="acme.com" className="pl-9 h-8 text-sm" />
            </div>
            <Button onClick={handleDomainSearch} disabled={loading || !domain} size="sm" className="bg-orange-500 hover:bg-orange-600 shrink-0">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </Button>
          </div>
          {result?.mode === 'domain' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span><strong>{result.emails?.length || 0}</strong> emails at {result.domain}</span>
                {result.pattern && <span className="bg-slate-100 px-2 py-0.5 rounded-full">Pattern: {result.pattern}</span>}
              </div>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {result.emails?.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{e.value}</p>
                      {(e.first_name || e.position) && (
                        <p className="text-xs text-slate-400 truncate">{[e.first_name, e.last_name].filter(Boolean).join(' ')}{e.position ? ` · ${e.position}` : ''}</p>
                      )}
                    </div>
                    <ScoreBadge score={e.confidence} />
                    <CopyBtn text={e.value} />
                    <button onClick={() => applyEmail(e.value)} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold shrink-0">Use</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* VERIFY */}
        <TabsContent value="verify" className="space-y-3 mt-3">
          <p className="text-xs text-slate-500">Check deliverability and validity of an email address.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="name@company.com" className="pl-9 h-8 text-sm" />
            </div>
            <Button onClick={handleVerify} disabled={loading || !emailInput} size="sm" className="bg-orange-500 hover:bg-orange-600 shrink-0">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            </Button>
          </div>
          {result?.mode === 'verify' && (
            <div className={`rounded-xl p-3 border space-y-2 text-sm ${
              result.status === 'valid' ? 'bg-emerald-50 border-emerald-100' :
              result.status === 'invalid' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'
            }`}>
              <div className="flex items-center gap-2">
                <StatusIcon status={result.status} />
                <span className="font-semibold capitalize">{result.status}</span>
                <ScoreBadge score={result.score} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>MX Records: {result.mx_records ? '✓' : '✗'}</span>
                <span>SMTP Server: {result.smtp_server ? '✓' : '✗'}</span>
                <span>SMTP Check: {result.smtp_check ? '✓' : '✗'}</span>
                <span>Disposable: {result.disposable ? 'Yes' : 'No'}</span>
                <span>Webmail: {result.webmail ? 'Yes' : 'No'}</span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* COMBINED ENRICHMENT */}
        <TabsContent value="combined" className="space-y-3 mt-3">
          <p className="text-xs text-slate-500">Get full person + company profile from an email address.</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="name@company.com" className="pl-9 h-8 text-sm" />
            </div>
            <Button onClick={handleCombined} disabled={loading || !emailInput} size="sm" className="bg-orange-500 hover:bg-orange-600 shrink-0">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </Button>
          </div>
          {result?.mode === 'combined' && (
            <div className="space-y-3">
              {/* Person */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <User className="w-3.5 h-3.5" /> Person
                </p>
                <Row label="Email"    value={result.person.email} />
                <Row label="Name"     value={[result.person.first_name, result.person.last_name].filter(Boolean).join(' ')} />
                <Row label="Title"    value={result.person.job_title} />
                <Row label="Phone"    value={result.person.phone} />
                <Row label="Location" value={result.person.location} />
                <Row label="LinkedIn" value={result.person.linkedin} />
                {result.person.bio && <p className="text-xs text-slate-500 pt-1 border-t border-slate-200">{result.person.bio}</p>}
              </div>
              {/* Company */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <Building2 className="w-3.5 h-3.5" /> Company
                </p>
                <Row label="Name"     value={result.company.name} />
                <Row label="Domain"   value={result.company.domain} />
                <Row label="Industry" value={result.company.industry} />
                <Row label="Size"     value={result.company.size ? `${result.company.size} employees` : null} />
                <Row label="Location" value={result.company.location} />
                <Row label="LinkedIn" value={result.company.linkedin} />
                {result.company.description && <p className="text-xs text-slate-500 pt-1 border-t border-slate-200 line-clamp-3">{result.company.description}</p>}
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={applyCombined}>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Apply All to Lead Profile
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>
      )}
    </div>
  );
}