import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import {
  Search, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Mail, Globe, Copy, Check, ShieldCheck, ShieldX
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

export default function HunterPanel({ lead, onApplyEmail }) {
  const [domain, setDomain] = useState(
    lead?.website ? lead.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : ''
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [copied, setCopied] = useState(null);

  const handleFind = async () => {
    if (!domain) return;
    setLoading(true);
    setResult(null);
    const res = await base44.functions.invoke('hunterEmailFinder', {
      domain,
      first_name: lead?.first_name || undefined,
      last_name: lead?.last_name || undefined,
    });
    setResult(res.data);
    setLoading(false);
  };

  const handleVerify = async (emailToVerify) => {
    setVerifyLoading(true);
    setVerifyResult(null);
    const res = await base44.functions.invoke('hunterEmailFinder', { email: emailToVerify });
    setVerifyResult(res.data);
    setVerifyLoading(false);
  };

  const copyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  const applyEmail = (email) => {
    if (onApplyEmail) onApplyEmail(email);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
          <img src="https://www.hunter.io/favicon.ico" alt="Hunter" className="w-4 h-4" onError={e => e.target.style.display='none'} />
          Hunter.io Email Finder
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Find and verify professional email addresses using Hunter.io.
        </p>
      </div>

      {/* Domain input */}
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company Domain</label>
        <div className="flex gap-2 mt-1">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="e.g. acme.com"
              className="pl-9"
            />
          </div>
          <Button
            onClick={handleFind}
            disabled={loading || !domain}
            className="bg-orange-500 hover:bg-orange-600 shrink-0"
          >
            {loading
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />
            }
            <span className="ml-1.5">{loading ? 'Searching...' : 'Find'}</span>
          </Button>
        </div>
        {(lead?.first_name || lead?.last_name) && (
          <p className="text-xs text-slate-400 mt-1">
            Will search for <strong>{lead.first_name} {lead.last_name}</strong> at this domain.
          </p>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Email Finder result */}
          {result.mode === 'finder' && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">Email Found</p>
              {result.email ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="font-semibold text-slate-800 flex-1">{result.email}</span>
                    <ScoreBadge score={result.score} />
                  </div>
                  {result.position && (
                    <p className="text-xs text-slate-500">Position: {result.position}</p>
                  )}
                  {result.sources?.length > 0 && (
                    <p className="text-xs text-slate-400">Sources: {result.sources.map(s => s.domain).join(', ')}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyEmail(result.email)}>
                      {copied === result.email ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === result.email ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleVerify(result.email)} disabled={verifyLoading}>
                      {verifyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Verify
                    </Button>
                    <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={() => applyEmail(result.email)}>
                      <Check className="w-3.5 h-3.5" /> Apply to Lead
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No email found for this person at {domain}.</p>
              )}
            </div>
          )}

          {/* Domain Search result */}
          {result.mode === 'domain' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {result.emails?.length || 0} emails found at {result.domain}
                </p>
                {result.pattern && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Pattern: {result.pattern}
                  </span>
                )}
              </div>
              {result.emails?.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">No emails found for this domain.</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {result.emails.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{e.value}</p>
                        {(e.first_name || e.position) && (
                          <p className="text-xs text-slate-400 truncate">{[e.first_name, e.last_name].filter(Boolean).join(' ')}{e.position ? ` · ${e.position}` : ''}</p>
                        )}
                      </div>
                      <ScoreBadge score={e.confidence} />
                      <button onClick={() => copyEmail(e.value)} className="text-slate-400 hover:text-slate-700 shrink-0 p-1">
                        {copied === e.value ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => applyEmail(e.value)} className="text-emerald-600 hover:text-emerald-700 shrink-0 p-1 text-xs font-medium">
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Verify result */}
          {verifyResult && verifyResult.mode === 'verify' && (
            <div className={`rounded-xl p-3 border text-sm space-y-1 ${
              verifyResult.status === 'valid' ? 'bg-emerald-50 border-emerald-100' :
              verifyResult.status === 'invalid' ? 'bg-rose-50 border-rose-100' :
              'bg-amber-50 border-amber-100'
            }`}>
              <div className="flex items-center gap-2">
                <StatusIcon status={verifyResult.status} />
                <span className="font-semibold capitalize">{verifyResult.status}</span>
                <ScoreBadge score={verifyResult.score} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 pt-1">
                {verifyResult.mx_records != null && <span>MX records: {verifyResult.mx_records ? '✓' : '✗'}</span>}
                {verifyResult.smtp_server != null && <span>SMTP server: {verifyResult.smtp_server ? '✓' : '✗'}</span>}
                {verifyResult.smtp_check != null && <span>SMTP check: {verifyResult.smtp_check ? '✓' : '✗'}</span>}
                {verifyResult.disposable != null && <span>Disposable: {verifyResult.disposable ? 'Yes' : 'No'}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verify existing email */}
      {lead?.email && !result && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500 mb-2">Verify existing email: <strong>{lead.email}</strong></p>
          <Button
            size="sm" variant="outline"
            onClick={() => handleVerify(lead.email)}
            disabled={verifyLoading}
            className="gap-1.5"
          >
            {verifyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />}
            {verifyLoading ? 'Verifying...' : 'Verify Email'}
          </Button>
          {verifyResult && verifyResult.mode === 'verify' && (
            <div className={`mt-2 rounded-xl p-3 border text-sm space-y-1 ${
              verifyResult.status === 'valid' ? 'bg-emerald-50 border-emerald-100' :
              verifyResult.status === 'invalid' ? 'bg-rose-50 border-rose-100' :
              'bg-amber-50 border-amber-100'
            }`}>
              <div className="flex items-center gap-2">
                <StatusIcon status={verifyResult.status} />
                <span className="font-semibold capitalize">{verifyResult.status}</span>
                <ScoreBadge score={verifyResult.score} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 pt-1">
                {verifyResult.mx_records != null && <span>MX records: {verifyResult.mx_records ? '✓' : '✗'}</span>}
                {verifyResult.smtp_server != null && <span>SMTP server: {verifyResult.smtp_server ? '✓' : '✗'}</span>}
                {verifyResult.smtp_check != null && <span>SMTP check: {verifyResult.smtp_check ? '✓' : '✗'}</span>}
                {verifyResult.disposable != null && <span>Disposable: {verifyResult.disposable ? 'Yes' : 'No'}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}