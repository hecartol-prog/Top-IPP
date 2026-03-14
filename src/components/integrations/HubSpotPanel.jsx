import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Download, Upload, Users, TrendingUp } from "lucide-react";

export default function HubSpotPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(null);
  const [result, setResult] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("hubspotSync", { action: "get_stats" });
      setStats(res.data);
    } catch (e) {
      setStats(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const handleSync = async (action) => {
    setSyncing(action);
    setResult(null);
    try {
      const res = await base44.functions.invoke("hubspotSync", { action });
      setResult(res.data);
      fetchStats();
    } catch (e) {
      setResult({ error: e.message });
    }
    setSyncing(null);
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
              <CardTitle className="text-lg font-semibold text-slate-900">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Sync contacts & deals</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-xs">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <Users className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-slate-900">{stats.contacts_total ?? "—"}</p>
              <p className="text-xs text-slate-500">Contacts</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <TrendingUp className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-slate-900">{stats.deals_total ?? "—"}</p>
              <p className="text-xs text-slate-500">Deals</p>
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-slate-200"
            onClick={() => handleSync("import_contacts")}
            disabled={!!syncing}
          >
            <Download className="w-4 h-4 text-orange-500" />
            {syncing === "import_contacts" ? "Importing..." : "Import contacts from HubSpot"}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-slate-200"
            onClick={() => handleSync("export_leads")}
            disabled={!!syncing}
          >
            <Upload className="w-4 h-4 text-orange-500" />
            {syncing === "export_leads" ? "Exporting..." : "Export leads to HubSpot"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-slate-500 gap-2"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh stats
          </Button>
        </div>

        {/* Result feedback */}
        {result && (
          <div className={`text-sm p-3 rounded-lg ${result.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {result.error ? (
              `Error: ${result.error}`
            ) : result.imported !== undefined ? (
              `✓ Imported ${result.imported} contacts from HubSpot`
            ) : result.exported !== undefined ? (
              `✓ Exported ${result.exported} leads to HubSpot${result.errors > 0 ? ` (${result.errors} skipped)` : ""}`
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}