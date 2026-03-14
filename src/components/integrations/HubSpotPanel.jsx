import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Upload, Download, AlertCircle } from "lucide-react";

export default function HubSpotPanel() {
  const [status, setStatus] = useState(null); // null | 'testing' | 'pushing' | 'pulling'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async (action, label) => {
    setStatus(action === 'test' ? 'testing' : action === 'push' ? 'pushing' : 'pulling');
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke('hubspotSync', { action });
    if (res.data?.success) {
      setResult({ action, ...res.data });
    } else {
      setError(res.data?.error || 'Something went wrong');
    }
    setStatus(null);
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Sync contacts & deals</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          Sync your Moldwise CRM leads with HubSpot contacts. Push your leads to HubSpot, or import HubSpot contacts as new leads.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => run('push')}
            disabled={!!status}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            {status === 'pushing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {status === 'pushing' ? 'Pushing to HubSpot...' : 'Push All Leads → HubSpot'}
          </Button>

          <Button
            onClick={() => run('pull')}
            disabled={!!status}
            variant="outline"
            className="w-full gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            {status === 'pulling' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {status === 'pulling' ? 'Importing from HubSpot...' : 'Pull HubSpot Contacts → Leads'}
          </Button>

          <Button
            onClick={() => run('test')}
            disabled={!!status}
            variant="ghost"
            className="w-full text-slate-500 gap-2 text-sm"
          >
            {status === 'testing' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Test Connection
          </Button>
        </div>

        {result && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            {result.action === 'push' && (
              <>✓ Pushed successfully — {result.created} created, {result.updated} updated
              {result.errors?.length > 0 && <p className="text-xs text-red-600 mt-1">{result.errors.length} errors</p>}
              </>
            )}
            {result.action === 'pull' && `✓ Imported ${result.imported} contacts as new leads`}
            {result.action === 'test' && `✓ Connection OK — ${result.total} contacts in HubSpot`}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}