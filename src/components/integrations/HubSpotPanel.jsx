import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Download, Upload, Users, Briefcase } from "lucide-react";

export default function HubSpotPanel() {
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(null);
  const [message, setMessage] = useState(null);
  const [selected, setSelected] = useState([]);
  const [tab, setTab] = useState("contacts");

  const fetchContacts = async () => {
    setLoading("contacts");
    setMessage(null);
    const res = await base44.functions.invoke('hubspotSync', { action: 'fetch_contacts' });
    setContacts(res.data.contacts || []);
    setSelected([]);
    setLoading(null);
  };

  const fetchDeals = async () => {
    setLoading("deals");
    setMessage(null);
    const res = await base44.functions.invoke('hubspotSync', { action: 'fetch_deals' });
    setDeals(res.data.deals || []);
    setLoading(null);
  };

  const importSelected = async () => {
    const toImport = contacts.filter(c => selected.includes(c.id));
    setLoading("importing");
    const res = await base44.functions.invoke('hubspotSync', { action: 'import_contacts', contacts: toImport });
    setMessage(`✅ Imported ${res.data.imported} contacts as leads`);
    setSelected([]);
    setLoading(null);
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelected(selected.length === contacts.length ? [] : contacts.map(c => c.id));
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
              <CardTitle className="text-lg">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Sync contacts and deals</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("contacts")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === "contacts" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Contacts
          </button>
          <button
            onClick={() => setTab("deals")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === "deals" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" /> Deals
          </button>
        </div>

        {/* Contacts Tab */}
        {tab === "contacts" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={fetchContacts}
                disabled={loading === "contacts"}
                className="gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading === "contacts" ? "animate-spin" : ""}`} />
                {loading === "contacts" ? "Loading..." : "Fetch Contacts"}
              </Button>
              {selected.length > 0 && (
                <Button
                  size="sm"
                  onClick={importSelected}
                  disabled={loading === "importing"}
                  className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  {loading === "importing" ? "Importing..." : `Import ${selected.length} as Leads`}
                </Button>
              )}
            </div>

            {contacts.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 flex items-center gap-2 border-b border-slate-100">
                  <input type="checkbox" checked={selected.length === contacts.length} onChange={toggleAll} className="rounded" />
                  <span className="text-xs font-medium text-slate-500">{contacts.length} contacts · {selected.length} selected</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                  {contacts.map(c => {
                    const p = c.properties || {};
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {p.firstname} {p.lastname}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{p.email} {p.company ? `· ${p.company}` : ""}</p>
                        </div>
                        {p.lifecyclestage && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">{p.lifecyclestage}</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deals Tab */}
        {tab === "deals" && (
          <div className="space-y-3">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchDeals}
              disabled={loading === "deals"}
              className="gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading === "deals" ? "animate-spin" : ""}`} />
              {loading === "deals" ? "Loading..." : "Fetch Deals"}
            </Button>

            {deals.length > 0 && (
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                  {deals.map(d => {
                    const p = d.properties || {};
                    return (
                      <div key={d.id} className="px-3 py-2.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900 truncate">{p.dealname || 'Unnamed Deal'}</p>
                          {p.amount && (
                            <span className="text-sm font-medium text-emerald-600 flex-shrink-0 ml-2">
                              ${Number(p.amount).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{p.dealstage} {p.closedate ? `· Close: ${p.closedate}` : ""}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {message && (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{message}</p>
        )}
      </CardContent>
    </Card>
  );
}