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
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('hubspotSync', { action: 'status' });
    if (res.data?.success) setStatus(res.data);
    else setError(res.data?.error || 'Could not connect to HubSpot');
    setLoading(false);
  };

  const handlePush = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke('hubspotSync', { action: 'push' });
    if (res.data?.success) setResult(res.data);
    else setError(res.data?.error || 'Push failed');
    setLoading(false);
  };

  const handlePull = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke('hubspotSync', { action: 'pull' });
    if (res.data?.success) setResult(res.data);
    else setError(res.data?.error || 'Pull failed');
    setLoading(false);
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
              <p className="text-xs text-slate-500 mt-0.5">Sync contacts & deals</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-xs">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status */}
        {status && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            <span className="font-medium">{status.hubspotTotal?.toLocaleString()}</span> contacts in HubSpot
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="w-full gap-2 text-sm"
            onClick={handlePush}
            disabled={loading}
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Push to HubSpot
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 text-sm"
            onClick={handlePull}
            disabled={loading}
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pull from HubSpot
          </Button>
        </div>

        <p className="text-xs text-slate-400 text-center">
          Push exports your CRM leads to HubSpot · Pull imports HubSpot contacts as new leads
        </p>

        {/* Result */}
        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            {result.action === 'push' && (
              <>✓ {result.created} created · {result.updated} updated in HubSpot
              {result.errors?.length > 0 && <span className="text-amber-600"> · {result.errors.length} errors</span>}
              </>
            )}
            {result.action === 'pull' && (
              <>✓ {result.imported} new leads imported from {result.total} HubSpot contacts</>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-slate-400 hover:text-slate-600"
          onClick={checkStatus}
          disabled={loading}
        >
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh status
        </Button>
      </CardContent>
    </Card>
  );
}