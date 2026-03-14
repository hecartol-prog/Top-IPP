import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Upload, Download, CheckCircle, AlertCircle } from "lucide-react";

export default function HubSpotPanel() {
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState(null);

  const runAction = async (action) => {
    setLoading(action);
    setResult(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action });
      setResult({ success: true, action, data: res.data });
    } catch (err) {
      setResult({ success: false, action, error: err.message });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-base">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Sync contacts & deals</p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-xs">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant="outline"
            className="justify-start gap-2 h-auto py-3"
            onClick={() => runAction('pull_contacts')}
            disabled={!!loading}
          >
            <Download className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium text-sm">Import Contacts from HubSpot</p>
              <p className="text-xs text-slate-400">Pull HubSpot contacts as new leads (skips duplicates)</p>
            </div>
            {loading === 'pull_contacts' && <RefreshCw className="w-4 h-4 ml-auto animate-spin" />}
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-2 h-auto py-3"
            onClick={() => runAction('push_contacts')}
            disabled={!!loading}
          >
            <Upload className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium text-sm">Export Leads to HubSpot</p>
              <p className="text-xs text-slate-400">Push local leads to HubSpot as contacts (skips duplicates)</p>
            </div>
            {loading === 'push_contacts' && <RefreshCw className="w-4 h-4 ml-auto animate-spin" />}
          </Button>
        </div>

        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.success ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            {result.success ? (
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  {result.action === 'pull_contacts' && (
                    <p>Imported <strong>{result.data.created}</strong> new leads, skipped <strong>{result.data.skipped}</strong> duplicates.</p>
                  )}
                  {result.action === 'push_contacts' && (
                    <p>Pushed <strong>{result.data.pushed}</strong> leads to HubSpot, skipped <strong>{result.data.skipped}</strong> duplicates.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{result.error}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}