import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Download, Upload, AlertCircle, Building2 } from "lucide-react";

export default function HubSpotPanel() {
  const [loading, setLoading] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchContacts = async () => {
    setLoading('fetch');
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'fetch_contacts' });
      setContacts(res.data.contacts || []);
      setSelected(new Set(res.data.contacts.map((_, i) => i)));
    } catch (e) {
      setError(e.message);
    }
    setLoading(null);
  };

  const importSelected = async () => {
    setLoading('import');
    setError(null);
    const leads = contacts.filter((_, i) => selected.has(i));
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'import_leads', leads });
      setResult(`✅ Imported ${res.data.imported} contacts as leads`);
      setContacts([]);
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    }
    setLoading(null);
  };

  const syncToHubSpot = async () => {
    setLoading('sync');
    setError(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action: 'sync_to_hubspot' });
      setResult(`✅ Synced ${res.data.synced} leads to HubSpot (${res.data.errors} errors)`);
    } catch (e) {
      setError(e.message);
    }
    setLoading(null);
  };

  const toggleSelect = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <Card className="border-0 shadow-sm bg-white">
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
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchContacts}
            disabled={!!loading}
            className="gap-2 text-slate-700"
          >
            <Download className="w-4 h-4" />
            {loading === 'fetch' ? 'Fetching...' : 'Fetch HubSpot Contacts'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={syncToHubSpot}
            disabled={!!loading}
            className="gap-2 text-slate-700"
          >
            <Upload className="w-4 h-4" />
            {loading === 'sync' ? 'Syncing...' : 'Push Leads → HubSpot'}
          </Button>
        </div>

        {/* Result / Error */}
        {result && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {result}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Contact List */}
        {contacts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">{contacts.length} contacts found — select to import:</p>
              <div className="flex gap-2">
                <button className="text-xs text-teal-600 hover:underline" onClick={() => setSelected(new Set(contacts.map((_, i) => i)))}>All</button>
                <button className="text-xs text-slate-400 hover:underline" onClick={() => setSelected(new Set())}>None</button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {contacts.map((c, i) => (
                <div
                  key={i}
                  onClick={() => toggleSelect(i)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-all ${
                    selected.has(i)
                      ? 'bg-teal-50 border-teal-200'
                      : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                >
                  <input type="checkbox" readOnly checked={selected.has(i)} className="accent-teal-600" />
                  <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{c.company_name} {c.email ? `· ${c.email}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              className="mt-3 w-full bg-slate-900 hover:bg-slate-800 text-white gap-2"
              onClick={importSelected}
              disabled={selected.size === 0 || loading === 'import'}
            >
              <RefreshCw className={`w-4 h-4 ${loading === 'import' ? 'animate-spin' : ''}`} />
              {loading === 'import' ? 'Importing...' : `Import ${selected.size} Contacts as Leads`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}