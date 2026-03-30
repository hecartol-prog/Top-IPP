import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Users, DollarSign, TrendingUp, Target, Calendar, ArrowRight } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RecentLeads from "../components/dashboard/RecentLeads";
import PipelineChart from "../components/dashboard/PipelineChart";
import MITWidget from "../components/dashboard/MITWidget";
import TodayActionsWidget from "../components/dashboard/TodayActionsWidget";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date')
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list('-created_date', 10)
  });

  // Calculate stats
  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
  const qualifiedLeads = leads.filter(l => ['qualified', 'proposal', 'negotiation'].includes(l.status)).length;
  const wonDeals = leads.filter(l => l.status === 'won').length;
  const conversionRate = totalLeads > 0 ? ((wonDeals / totalLeads) * 100).toFixed(1) : 0;

  // Upcoming follow-ups
  const upcomingFollowUps = leads
    .filter(l => l.next_follow_up && new Date(l.next_follow_up) >= new Date())
    .sort((a, b) => new Date(a.next_follow_up) - new Date(b.next_follow_up))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-slate-900 tracking-tight"
          >
            Dashboard
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 mt-1"
          >
            Overview of your sales pipeline and lead activity
          </motion.p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
          <StatCard 
            title="Total Leads" 
            value={totalLeads}
            icon={Users}
            color="blue"
            trend="+12% this month"
            trendUp
          />
          <StatCard 
            title="Pipeline Value" 
            value={`$${(totalValue / 1000).toFixed(0)}k`}
            icon={DollarSign}
            color="teal"
            trend="+8% this month"
            trendUp
          />
          <StatCard 
            title="Qualified Leads" 
            value={qualifiedLeads}
            icon={Target}
            color="amber"
          />
          <StatCard 
            title="Conversion Rate" 
            value={`${conversionRate}%`}
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Chart & Recent Leads */}
          <div className="lg:col-span-2 space-y-6">
            <PipelineChart leads={leads} />
            <RecentLeads 
              leads={leads}
              onViewAll={() => window.location.href = createPageUrl('Leads')}
              onLeadClick={(lead) => window.location.href = createPageUrl('Leads') + `?id=${lead.id}`}
            />
          </div>

          {/* Right Column - Today Actions + MITs + Follow-ups */}
          <div className="space-y-6">
            <TodayActionsWidget />
            <MITWidget />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className="bg-white border-0 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Upcoming Follow-ups
                  </CardTitle>
                  <Calendar className="w-5 h-5 text-slate-400" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingFollowUps.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No upcoming follow-ups</p>
                    </div>
                  ) : (
                    upcomingFollowUps.map((lead) => (
                      <Link
                        key={lead.id}
                        to={createPageUrl('Leads') + `?id=${lead.id}`}
                        className="block p-3 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-slate-900">
                              {lead.first_name} {lead.last_name}
                            </p>
                            <p className="text-xs text-slate-500">{lead.company_name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-amber-600">
                              {format(new Date(lead.next_follow_up), 'MMM d')}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-0 text-white">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <Link 
                      to={createPageUrl('Leads') + '?action=new'}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <span className="text-sm font-medium">Add New Lead</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link 
                      to={createPageUrl('Pipeline')}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <span className="text-sm font-medium">View Pipeline</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link 
                      to={createPageUrl('Companies')}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <span className="text-sm font-medium">Manage Companies</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link 
                      to="/Templates"
                      className="flex items-center justify-between p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      <span className="text-sm font-medium">Email & Script Templates</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}