import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Upload, Download, AlertCircle } from "lucide-react";

export default function HubSpotPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'status' });
      setStatus(res.data);
    } catch (e) {
      setError('Could not reach HubSpot');
    }
  };

  const handlePush = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'push' });
      setResult({ type: 'push', ...res.data });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'pull' });
      setResult({ type: 'pull', ...res.data });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Contacts, Deals & Companies</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* HubSpot stats */}
        {status && (
          <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-slate-600">HubSpot contacts</span>
            <span className="font-semibold text-slate-900">{status.total?.toLocaleString()}</span>
          </div>
        )}

        {/* Sync actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handlePush}
            disabled={loading}
            variant="outline"
            className="flex flex-col h-auto py-3 gap-1 border-slate-200"
          >
            <Upload className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium">Push to HubSpot</span>
            <span className="text-[10px] text-slate-400">Export all leads</span>
          </Button>
          <Button
            onClick={handlePull}
            disabled={loading}
            variant="outline"
            className="flex flex-col h-auto py-3 gap-1 border-slate-200"
          >
            <Download className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium">Pull from HubSpot</span>
            <span className="text-[10px] text-slate-400">Import contacts</span>
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 justify-center py-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Syncing with HubSpot...
          </div>
        )}

        {result && !loading && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            {result.type === 'push' ? (
              <>✓ {result.created} created, {result.updated} updated
              {result.errors?.length > 0 && <p className="text-red-600 mt-1">{result.errors.length} errors</p>}
              </>
            ) : (
              <>✓ {result.imported} contacts imported</>
            )}
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <p className="text-xs text-slate-400">
          Push exports all CRM leads to HubSpot. Pull imports HubSpot contacts as new leads.
        </p>
      </CardContent>
    </Card>
  );
}