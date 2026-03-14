import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Upload, Download, AlertCircle } from "lucide-react";

export default function HubSpotPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'stats' });
      setStats(res.data);
    } catch (e) {
      setError("Could not connect to HubSpot");
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
    }
    setLoading(false);
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
    }
    setLoading(false);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-lg">HubSpot CRM</CardTitle>
              <p className="text-sm text-slate-500">Contacts & Deals sync</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-slate-600">HubSpot contacts</span>
            <span className="font-semibold text-slate-900">{stats.total?.toLocaleString() || 0}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handlePush}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Push to HubSpot
          </Button>
          <Button
            onClick={handlePull}
            disabled={loading}
            variant="outline"
            className="gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pull from HubSpot
          </Button>
        </div>

        <p className="text-xs text-slate-400">
          <strong>Push:</strong> Sends all Moldwise leads (with email) to HubSpot. <strong>Pull:</strong> Imports new HubSpot contacts into Moldwise.
        </p>

        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            {result.type === 'push' ? (
              <>✓ Pushed — {result.created} created, {result.updated} updated{result.errors?.length > 0 ? `, ${result.errors.length} errors` : ''}</>
            ) : (
              <>✓ Pulled — {result.imported} new contacts imported</>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}