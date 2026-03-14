import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Upload, Users, Building2, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";

export default function HubSpotPanel() {
  const [syncResult, setSyncResult] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: contactsData, isLoading: loadingContacts, refetch: refetchContacts } = useQuery({
    queryKey: ['hubspot-contacts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('hubspotSync', { action: 'getContacts' });
      return res.data;
    },
  });

  const { data: companiesData, isLoading: loadingCompanies, refetch: refetchCompanies } = useQuery({
    queryKey: ['hubspot-companies'],
    queryFn: async () => {
      const res = await base44.functions.invoke('hubspotSync', { action: 'getCompanies' });
      return res.data;
    },
  });

  const { data: dealsData, isLoading: loadingDeals, refetch: refetchDeals } = useQuery({
    queryKey: ['hubspot-deals'],
    queryFn: async () => {
      const res = await base44.functions.invoke('hubspotSync', { action: 'getDeals' });
      return res.data;
    },
  });

  const handleSyncLeads = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const leads = await base44.entities.Lead.list();
      const res = await base44.functions.invoke('hubspotSync', { 
        action: 'syncLeadsToHubSpot', 
        data: { leads } 
      });
      setSyncResult(res.data);
      refetchContacts();
    } catch (e) {
      setSyncResult({ error: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const contactCount = contactsData?.results?.length ?? '–';
  const companyCount = companiesData?.results?.length ?? '–';
  const dealCount = dealsData?.results?.length ?? '–';

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
              <p className="text-sm text-slate-500 mt-0.5">Sync contacts, companies & deals</p>
            </div>
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border">
            <CheckCircle className="w-3 h-3 mr-1" /> Connected
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-slate-800">
              {loadingContacts ? '...' : contactCount}
            </p>
            <p className="text-xs text-slate-500">Contacts</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <Building2 className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-slate-800">
              {loadingCompanies ? '...' : companyCount}
            </p>
            <p className="text-xs text-slate-500">Companies</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <TrendingUp className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-slate-800">
              {loadingDeals ? '...' : dealCount}
            </p>
            <p className="text-xs text-slate-500">Deals</p>
          </div>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <div className={`rounded-lg p-3 text-sm ${syncResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {syncResult.error ? (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{syncResult.error}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Synced {syncResult.created} leads to HubSpot{syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSyncLeads}
            disabled={isSyncing}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            size="sm"
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync Leads → HubSpot'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchContacts(); refetchCompanies(); refetchDeals(); }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-slate-400">
          Syncing pushes your CRM leads to HubSpot as contacts. Existing contacts are skipped.
        </p>
      </CardContent>
    </Card>
  );
}