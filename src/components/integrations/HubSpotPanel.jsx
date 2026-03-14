import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Upload, Download, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function HubSpotPanel() {
  const [status, setStatus] = useState(null); // null | { connected, total }
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const checkStatus = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'status' });
      setStatus(res.data);
    } catch {
      setStatus({ connected: false, error: 'Could not reach HubSpot' });
    }
    setLoading(false);
  };

  const pushLeads = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'push' });
      setResult({ type: 'push', ...res.data });
    } catch (e) {
      setResult({ type: 'error', message: e.message });
    }
    setLoading(false);
  };

  const pullContacts = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'pull' });
      setResult({ type: 'pull', ...res.data });
    } catch (e) {
      setResult({ type: 'error', message: e.message });
    }
    setLoading(false);
  };

  useEffect(() => { checkStatus(); }, []);

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Sync contacts & deals</p>
            </div>
          </div>
          {status === null ? (
            <Badge variant="secondary" className="text-xs">Checking...</Badge>
          ) : status.connected ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-xs">
              <CheckCircle className="w-3 h-3 mr-1" /> Connected
            </Badge>
          ) : (
            <Badge className="bg-red-50 text-red-600 border-red-200 border text-xs">
              <AlertCircle className="w-3 h-3 mr-1" /> Error
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {status?.connected && (
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{status.total?.toLocaleString()}</span> contacts in HubSpot
          </p>
        )}
        {status?.error && (
          <p className="text-xs text-red-500">{status.error}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={pushLeads}
            disabled={loading || !status?.connected}
            variant="outline"
            className="gap-2 text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Push Leads → HS
          </Button>
          <Button
            onClick={pullContacts}
            disabled={loading || !status?.connected}
            variant="outline"
            className="gap-2 text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pull HS → Leads
          </Button>
        </div>

        <Button
          onClick={checkStatus}
          disabled={loading}
          variant="ghost"
          size="sm"
          className="w-full gap-2 text-slate-500 text-xs"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>

        {result && (
          <div className={`p-3 rounded-lg text-sm ${
            result.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {result.type === 'push' && (
              <p>✓ Pushed: <strong>{result.created}</strong> created, <strong>{result.updated}</strong> updated
                {result.errors?.length > 0 && `, ${result.errors.length} errors`}
              </p>
            )}
            {result.type === 'pull' && (
              <p>✓ Imported <strong>{result.imported}</strong> contacts from HubSpot</p>
            )}
            {result.type === 'error' && <p>✗ {result.message}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}