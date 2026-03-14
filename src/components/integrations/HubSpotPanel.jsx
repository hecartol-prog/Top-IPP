import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Download, Upload, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

export default function HubSpotPanel() {
  const [loading, setLoading] = useState(null);
  const [result, setResult] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState(null);

  const runAction = async (action) => {
    setLoading(action);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke('hubspotSync', { action });
      const data = res.data;
      if (action === 'fetch_contacts') {
        setContacts(data.contacts || []);
        setResult(`Fetched ${data.total ?? data.contacts?.length ?? 0} contacts from HubSpot`);
      } else if (action === 'import_contacts') {
        setResult(`Imported ${data.imported} contacts as leads (${data.skipped} skipped)`);
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Something went wrong');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Contacts, Deals & Companies</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border text-xs">
            ✓ Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => runAction('fetch_contacts')}
            disabled={!!loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading === 'fetch_contacts' ? 'animate-spin' : ''}`} />
            {loading === 'fetch_contacts' ? 'Loading...' : 'Fetch Contacts'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={() => runAction('import_contacts')}
            disabled={!!loading}
          >
            <Download className={`w-3.5 h-3.5 ${loading === 'import_contacts' ? 'animate-spin' : ''}`} />
            {loading === 'import_contacts' ? 'Importing...' : 'Import as Leads'}
          </Button>
        </div>

        {/* Feedback */}
        {result && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {result}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Contact Preview */}
        {contacts.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {contacts.length} contacts
            </p>
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {c.properties.firstname} {c.properties.lastname}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {c.properties.company || c.properties.email || '—'}
                  </p>
                </div>
                {c.properties.lifecyclestage && (
                  <Badge variant="outline" className="text-[10px] ml-2 flex-shrink-0">
                    {c.properties.lifecyclestage}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-400 pt-1">
          Scopes: contacts, deals &amp; companies read/write
        </p>
      </CardContent>
    </Card>
  );
}