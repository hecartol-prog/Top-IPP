import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, CheckCircle, AlertCircle, Building2, Users, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function HubSpotPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncLog, setSyncLog] = useState(null);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['hubspot-stats'],
    queryFn: async () => {
      const res = await base44.functions.invoke('hubspotSync', { action: 'get_stats' });
      return res.data.stats;
    },
    retry: false,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('hubspotSync', { action: 'push_contacts', leads });
      return res.data;
    },
    onSuccess: (data) => {
      setSyncLog(data.results);
      toast({ title: "Pushed to HubSpot", description: `Created: ${data.results.created}, Updated: ${data.results.updated}, Failed: ${data.results.failed}` });
      refetchStats();
    },
    onError: (err) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
  });

  const pullMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('hubspotSync', { action: 'pull_contacts' });
      return res.data;
    },
    onSuccess: async (data) => {
      const contacts = data.contacts || [];
      let imported = 0;
      for (const contact of contacts) {
        if (contact.first_name || contact.last_name || contact.company_name) {
          await base44.entities.Lead.create(contact);
          imported++;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSyncLog({ pulled: contacts.length, imported });
      toast({ title: "Pulled from HubSpot", description: `Imported ${imported} contacts into Moldwise` });
    },
    onError: (err) => toast({ title: "Pull failed", description: err.message, variant: "destructive" }),
  });

  const isBusy = pushMutation.isPending || pullMutation.isPending;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">HS</span>
            </div>
            <div>
              <CardTitle className="text-lg">HubSpot CRM</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Contacts, Deals & Companies</p>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">✓ Connected</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Contacts", value: stats?.contacts, icon: Users },
            { label: "Companies", value: stats?.companies, icon: Building2 },
            { label: "Deals", value: stats?.deals, icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-slate-50 rounded-lg p-3 text-center">
              <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-800">
                {statsLoading ? '—' : (value ?? '—')}
              </p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Sync Actions */}
        <div className="space-y-2">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => pushMutation.mutate()}
            disabled={isBusy || leads.length === 0}
          >
            {pushMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowUpCircle className="w-4 h-4 mr-2" />
            )}
            Push {leads.length} Leads → HubSpot
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => pullMutation.mutate()}
            disabled={isBusy}
          >
            {pullMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowDownCircle className="w-4 h-4 mr-2" />
            )}
            Pull Contacts ← HubSpot
          </Button>
        </div>

        {/* Sync Log */}
        {syncLog && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <p className="font-medium text-slate-700 flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Last sync result
            </p>
            {syncLog.created !== undefined && <p className="text-slate-500">Created: <span className="text-emerald-600 font-medium">{syncLog.created}</span></p>}
            {syncLog.updated !== undefined && <p className="text-slate-500">Updated: <span className="text-blue-600 font-medium">{syncLog.updated}</span></p>}
            {syncLog.failed !== undefined && <p className="text-slate-500">Failed: <span className="text-red-500 font-medium">{syncLog.failed}</span></p>}
            {syncLog.imported !== undefined && <p className="text-slate-500">Imported: <span className="text-emerald-600 font-medium">{syncLog.imported}</span></p>}
            {syncLog.errors?.length > 0 && (
              <div className="mt-1">
                {syncLog.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-500">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-slate-400">
          Push exports Moldwise leads to HubSpot contacts. Pull imports HubSpot contacts as new leads.
        </p>
      </CardContent>
    </Card>
  );
}