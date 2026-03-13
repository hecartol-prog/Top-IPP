import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { calculateLeadScore, getScoreLabel } from "@/components/leads/leadScoring";

const statusColors = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-purple-100 text-purple-700",
  qualified: "bg-amber-100 text-amber-700",
  proposal: "bg-cyan-100 text-cyan-700",
  negotiation: "bg-orange-100 text-orange-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-slate-100 text-slate-700"
};

export default function RecentLeads({ leads, onViewAll, onLeadClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold text-slate-900">Recent Leads</CardTitle>
          <button 
            onClick={onViewAll}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {leads.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No leads yet</p>
            </div>
          ) : (
            leads.slice(0, 5).map((lead) => {
              const initials = `${lead.first_name?.[0] || ''}${lead.last_name?.[0] || ''}`.toUpperCase();
              
              return (
                <div 
                  key={lead.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => onLeadClick(lead)}
                >
                  <Avatar className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-800">
                    <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-800 text-white text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm uppercase tracking-wide truncate">
                      {lead.company_name}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {lead.first_name} {lead.last_name}
                    </p>
                  </div>
                  
                  <div className="text-right space-y-1">
                    <Badge className={`${statusColors[lead.status]} text-xs`}>
                      {lead.status}
                    </Badge>
                    {(() => {
                      const s = calculateLeadScore(lead);
                      const { label, color } = getScoreLabel(s);
                      return <Badge className={`text-[10px] border ${color} block`}>{label} {s}</Badge>;
                    })()}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}