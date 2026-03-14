import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, ArrowUpDown, ArrowDown, ArrowUp, Users, Building2, DollarSign } from "lucide-react";

const SYNC_OPTIONS = [
  { key: "contacts", label: "Contacts / Leads", icon: Users },
  { key: "companies", label: "Companies", icon: Building2 },
  { key: "deals", label: "Deals", icon: DollarSign },
];

export default function HubSpotPanel() {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const runSync = async (direction) => {
    setSyncing(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { direction, entity_type: null });
      setLastResult(res.data?.synced);
    } catch (e) {
      setError(e.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#ff7a59] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-base">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Sync contacts, companies & deals</p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-xs">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Synced entities preview */}
        <div className="grid grid-cols-3 gap-2">
          {SYNC_OPTIONS.map(({ key, label, icon: SyncIcon }) => (
            <div key={key} className="bg-slate-50 rounded-lg p-2 text-center">
              <SyncIcon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-600 font-medium">{label.split(' / ')[0]}</p>
              {lastResult && (
                <p className="text-xs text-teal-600 font-bold">{lastResult[key]} synced</p>
              )}
            </div>
          ))}
        </div>

        {/* Sync buttons */}
        <div className="space-y-2">
          <Button
            className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-2 h-9"
            onClick={() => runSync('to_hubspot')}
            disabled={syncing}
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            Push to HubSpot
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 h-9"
            onClick={() => runSync('from_hubspot')}
            disabled={syncing}
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />}
            Pull from HubSpot
          </Button>
          <Button
            variant="outline"
            className="w-full gap-2 h-9 border-teal-200 text-teal-700 hover:bg-teal-50"
            onClick={() => runSync('both')}
            disabled={syncing}
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowUpDown className="w-4 h-4" />}
            Bidirectional Sync
          </Button>
        </div>

        {lastResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            ✓ Sync complete — {lastResult.contacts} contacts, {lastResult.companies} companies, {lastResult.deals} deals
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ✗ {error}
          </div>
        )}

        <p className="text-xs text-slate-400">
          Scopes: Contacts · Companies · Deals (read + write)
        </p>
      </CardContent>
    </Card>
  );
}