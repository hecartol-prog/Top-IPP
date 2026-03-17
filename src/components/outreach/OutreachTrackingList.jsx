import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Eye, MousePointer, Send, Plus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import ComposeEmailDialog from "./ComposeEmailDialog";

const statusConfig = {
  draft:   { label: "Draft",   color: "bg-slate-100 text-slate-600" },
  sent:    { label: "Sent",    color: "bg-blue-100 text-blue-700" },
  opened:  { label: "Opened",  color: "bg-amber-100 text-amber-700" },
  clicked: { label: "Clicked", color: "bg-emerald-100 text-emerald-700" },
  replied: { label: "Replied", color: "bg-teal-100 text-teal-700" },
  bounced: { label: "Bounced", color: "bg-rose-100 text-rose-700" },
};

export default function OutreachTrackingList({ lead }) {
  const [showCompose, setShowCompose] = useState(false);
  const queryClient = useQueryClient();

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['outreach-lead', lead?.id],
    queryFn: () => base44.entities.EmailOutreach.filter({ lead_id: lead.id }, '-sent_at', 50),
    enabled: !!lead?.id
  });

  const handleSent = () => {
    queryClient.invalidateQueries({ queryKey: ['outreach-lead', lead?.id] });
    queryClient.invalidateQueries({ queryKey: ['email-outreach'] });
  };

  if (!lead) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Email Outreach</p>
          <p className="text-xs text-slate-400">{emails.length} email{emails.length !== 1 ? 's' : ''} sent</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8 w-8 p-0">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={() => setShowCompose(true)} className="bg-teal-600 hover:bg-teal-700 h-8">
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Email
          </Button>
        </div>
      </div>

      {!lead.email && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          ⚠ No email address on this lead. Add an email to enable outreach.
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center">
          <RefreshCw className="w-5 h-5 mx-auto text-slate-400 animate-spin" />
        </div>
      ) : emails.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No emails sent yet</p>
          <p className="text-xs mt-1">Click "New Email" to start an outreach sequence</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(email => {
            const cfg = statusConfig[email.status] || statusConfig.sent;
            return (
              <div key={email.id} className="border border-slate-200 rounded-xl p-3 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{email.subject}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
                      {email.campaign_name && (
                        <span className="text-xs text-slate-400 truncate">{email.campaign_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-xs text-slate-400">
                    {email.sent_at && format(new Date(email.sent_at), 'MMM d, HH:mm')}
                  </div>
                </div>

                {/* Tracking metrics */}
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Eye className={`w-3.5 h-3.5 ${email.open_count > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                    <span className={email.open_count > 0 ? 'text-amber-700 font-medium' : 'text-slate-400'}>
                      {email.open_count || 0} open{email.open_count !== 1 ? 's' : ''}
                    </span>
                    {email.opened_at && (
                      <span className="text-slate-400">· first {format(new Date(email.opened_at), 'MMM d')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <MousePointer className={`w-3.5 h-3.5 ${email.click_count > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <span className={email.click_count > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                      {email.click_count || 0} click{email.click_count !== 1 ? 's' : ''}
                    </span>
                    {email.clicked_at && (
                      <span className="text-slate-400">· first {format(new Date(email.clicked_at), 'MMM d')}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ComposeEmailDialog
        open={showCompose}
        onClose={() => setShowCompose(false)}
        lead={lead}
        onSent={handleSent}
      />
    </div>
  );
}