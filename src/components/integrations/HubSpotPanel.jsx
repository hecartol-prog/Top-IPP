import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Upload, Download, AlertCircle } from "lucide-react";

export default function HubSpotPanel() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(null);
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
      setError('Could not connect to HubSpot');
    }
  };

  const handleSync = async (action) => {
    setLoading(action);
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action });
      setResult(res.data);
    } catch (e) {
      setError(e.message || 'Sync failed');
    } finally {
      setLoading(null);
    }
  };

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
              <p className="text-xs text-slate-500 mt-0.5">Sync contacts & leads</p>
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
            <span className="font-medium text-slate-800">{status.total?.toLocaleString()}</span> contacts in HubSpot
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="gap-2 text-sm"
            onClick={() => handleSync('push')}
            disabled={!!loading}
          >
            {loading === 'push' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Push to HubSpot
          </Button>

          <Button
            variant="outline"
            className="gap-2 text-sm"
            onClick={() => handleSync('pull')}
            disabled={!!loading}
          >
            {loading === 'pull' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Pull from HubSpot
          </Button>
        </div>

        <p className="text-xs text-slate-400">
          <strong>Push</strong> exports your Moldwise leads to HubSpot. <strong>Pull</strong> imports HubSpot contacts as new leads (skips duplicates).
        </p>

        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
            {result.action === 'push' && (
              <>✓ Pushed — {result.created} created, {result.updated} updated{result.errors?.length > 0 && `, ${result.errors.length} errors`}</>
            )}
            {result.action === 'pull' && (
              <>✓ Pulled — {result.imported} imported, {result.skipped} skipped (duplicates or incomplete)</>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}