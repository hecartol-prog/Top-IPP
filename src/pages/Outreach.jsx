import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import ComposeEmailDialog from "@/components/outreach/ComposeEmailDialog";
import CampaignBuilderDialog from "@/components/outreach/CampaignBuilderDialog";
import { format } from "date-fns";
import {
  Mail, Plus, Eye, MousePointer, Send, Search,
  TrendingUp, CheckCircle, BarChart3, RefreshCw, Users
} from "lucide-react";

const statusConfig = {
  draft:   { label: "Draft",   color: "bg-slate-100 text-slate-600" },
  sent:    { label: "Sent",    color: "bg-blue-100 text-blue-700" },
  opened:  { label: "Opened",  color: "bg-amber-100 text-amber-700" },
  clicked: { label: "Clicked", color: "bg-emerald-100 text-emerald-700" },
  replied: { label: "Replied", color: "bg-teal-100 text-teal-700" },
  bounced: { label: "Bounced", color: "bg-rose-100 text-rose-700" },
};

export default function Outreach() {
  const [showCompose, setShowCompose] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [composeLead, setComposeLead] = useState(null);
  const queryClient = useQueryClient();

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['email-outreach'],
    queryFn: () => base44.entities.EmailOutreach.list('-sent_at', 200)
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list()
  });

  const totalSent = emails.filter(e => e.status !== 'draft').length;
  const totalOpened = emails.filter(e => (e.open_count || 0) > 0).length;
  const totalClicked = emails.filter(e => (e.click_count || 0) > 0).length;
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  const filtered = emails.filter(e => {
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    const matchSearch = !search || e.subject?.toLowerCase().includes(search.toLowerCase()) ||
      e.lead_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.campaign_name?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleSent = () => {
    queryClient.invalidateQueries({ queryKey: ['email-outreach'] });
    setShowCompose(false);
    setComposeLead(null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Outreach</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-personalized emails with open & click tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => { setComposeLead(null); setShowCompose(true); }} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Sent", value: totalSent, icon: Send, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Opened", value: totalOpened, icon: Eye, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Clicked", value: totalClicked, icon: MousePointer, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Open Rate", value: `${openRate}%`, icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Click Rate", value: `${clickRate}%`, icon: BarChart3, color: "text-teal-600", bg: "bg-teal-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-lg font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emails..." className="pl-9 h-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "sent", "opened", "clicked", "replied", "bounced"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filterStatus === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Email List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No emails yet</p>
          <p className="text-sm mt-1">Compose your first outreach email to get started</p>
          <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={() => setShowCompose(true)}>
            <Plus className="w-4 h-4 mr-2" />Compose Email
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaign</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Opens</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Clicks</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(email => {
                const cfg = statusConfig[email.status] || statusConfig.sent;
                const lead = leads.find(l => l.id === email.lead_id);
                return (
                  <tr key={email.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 truncate max-w-[140px]">{email.lead_name || "—"}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[140px]">{email.lead_email}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="truncate text-slate-700">{email.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">{email.campaign_name || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Eye className={`w-3.5 h-3.5 ${(email.open_count || 0) > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                        <span className={`text-xs ${(email.open_count || 0) > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                          {email.open_count || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <MousePointer className={`w-3.5 h-3.5 ${(email.click_count || 0) > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
                        <span className={`text-xs ${(email.click_count || 0) > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                          {email.click_count || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400">
                        {email.sent_at ? format(new Date(email.sent_at), 'MMM d, HH:mm') : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ComposeEmailDialog
        open={showCompose}
        onClose={() => { setShowCompose(false); setComposeLead(null); }}
        lead={composeLead || leads[0]}
        onSent={handleSent}
      />
    </div>
  );
}