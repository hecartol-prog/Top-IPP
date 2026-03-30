import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, MapPin, DollarSign, Calendar, Zap } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import LeadTemperatureBadge from "./LeadTemperatureBadge";

const statusColors = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-purple-100 text-purple-700 border-purple-200",
  qualified: "bg-amber-100 text-amber-700 border-amber-200",
  proposal: "bg-cyan-100 text-cyan-700 border-cyan-200",
  negotiation: "bg-orange-100 text-orange-700 border-orange-200",
  won: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-slate-100 text-slate-700 border-slate-200"
};

const priorityColors = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-amber-100 text-amber-600",
  urgent: "bg-rose-100 text-rose-600"
};

const sourceIcons = {
  linkedin: "🔗",
  leadiq: "📊",
  referral: "👥",
  website: "🌐",
  trade_show: "🎪",
  cold_outreach: "📞",
  other: "📋"
};

export default function LeadCard({ lead, onClick }) {
  const initials = `${lead.first_name?.[0] || ''}${lead.last_name?.[0] || ''}`.toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="p-5 bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all duration-300 cursor-pointer group"
        onClick={onClick}
      >
        <div className="flex items-start gap-4">
          <Avatar className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 text-white">
            <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wide group-hover:text-teal-600 transition-colors">
                  {lead.company_name}
                </h3>
                <p className="text-sm text-slate-600 font-medium">{lead.first_name} {lead.last_name}</p>
                {lead.job_title && <p className="text-xs text-slate-400">{lead.job_title}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{sourceIcons[lead.source] || '📋'}</span>
                <Badge className={`${priorityColors[lead.priority]} border-0 text-xs font-medium`}>
                  {lead.priority}
                </Badge>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span className="truncate max-w-[150px]">{lead.company_name}</span>
              </div>
              {lead.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[100px]">{lead.location}</span>
                </div>
              )}
              {lead.estimated_value && (
                <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{lead.estimated_value.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${statusColors[lead.status]} border text-xs font-medium`}>
                  {lead.status?.replace('_', ' ')}
                </Badge>
                {lead.temperature && <LeadTemperatureBadge temperature={lead.temperature} />}
                {lead.apollo_enrichment_status === "enriched" && (
                  <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-xs flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5" /> Enriched
                  </Badge>
                )}
                {lead.apollo_enrichment_status === "failed" && (
                  <Badge className="bg-rose-50 text-rose-500 border-rose-200 text-xs">No match</Badge>
                )}
              </div>
              {lead.next_follow_up && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3 h-3" />
                  <span>Follow up: {format(new Date(lead.next_follow_up), 'MMM d')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}