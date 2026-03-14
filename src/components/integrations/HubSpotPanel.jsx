import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Upload, Download, Loader2 } from "lucide-react";

export default function HubSpotPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('hubspotSync', { action: 'status' });
    setStatus(res.data);
    setLoading(false);
  };

  const handlePush = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke('hubspotSync', { action: 'push' });
    if (res.data?.success) setResult({ type: 'push', ...res.data });
    else setError(res.data?.error || 'Push failed');
    setLoading(false);
  };

  const handlePull = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke('hubspotSync', { action: 'pull' });
    if (res.data?.success) setResult({ type: 'pull', ...res.data });
    else setError(res.data?.error || 'Pull failed');
    setLoading(false);
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Sync contacts & deals</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-xs">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status && (
          <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-600">
            HubSpot account active · <span className="font-medium">{status.contactsAvailable?.toLocaleString()}</span> contacts available
          </div>
        )}

        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
            {result.type === 'push'
              ? `✓ Exported — ${result.created} created, ${result.updated} updated${result.failed ? `, ${result.failed} failed` : ''}`
              : `✓ Imported ${result.imported} contacts from HubSpot`}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handlePush}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Push to HubSpot
          </Button>
          <Button
            onClick={handlePull}
            disabled={loading}
            variant="outline"
            className="gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pull from HubSpot
          </Button>
        </div>

        <button
          onClick={checkStatus}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Refresh status
        </button>

        <div className="text-xs text-slate-400 space-y-1 pt-1 border-t border-slate-100">
          <p><strong>Push:</strong> Exports all Moldwise leads to HubSpot as contacts</p>
          <p><strong>Pull:</strong> Imports HubSpot contacts into Moldwise as new leads</p>
        </div>
      </CardContent>
    </Card>
  );
}