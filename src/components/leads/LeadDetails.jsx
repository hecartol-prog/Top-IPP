import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, MapPin, DollarSign, Calendar, Mail, Phone, Linkedin, Globe,
  Pencil, Trash2, Plus, CheckCircle2, Circle, Clock, MessageSquare, 
  PhoneCall, Users, FileText, Send, Search
} from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

const statusColors = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-purple-100 text-purple-700 border-purple-200",
  qualified: "bg-amber-100 text-amber-700 border-amber-200",
  proposal: "bg-cyan-100 text-cyan-700 border-cyan-200",
  negotiation: "bg-orange-100 text-orange-700 border-orange-200",
  won: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lost: "bg-slate-100 text-slate-700 border-slate-200"
};

const activityIcons = {
  call: PhoneCall,
  email: Mail,
  meeting: Users,
  note: FileText,
  linkedin_message: Linkedin,
  proposal_sent: Send,
  follow_up: Clock
};

const outcomeColors = {
  positive: "text-emerald-600",
  neutral: "text-slate-500",
  negative: "text-rose-600",
  no_response: "text-amber-600"
};

const statusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" }
];

const activityTypeOptions = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "linkedin_message", label: "LinkedIn Message" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "follow_up", label: "Follow Up" }
];

function ActivityItem({ activity }) {
  const Icon = activityIcons[activity.type] || FileText;
  return (
    <div className="flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm text-slate-900">{activity.title}</p>
          {activity.outcome && (
            <span className={`text-xs font-medium ${outcomeColors[activity.outcome]}`}>
              {activity.outcome.replace('_', ' ')}
            </span>
          )}
        </div>
        {activity.description && (
          <p className="text-sm text-slate-500 mt-1">{activity.description}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          {activity.created_date ? format(new Date(activity.created_date), 'MMM d, yyyy') : ''}
        </p>
      </div>
    </div>
  );
}

function AddActivityForm({ leadId, onActivityCreate, onClose }) {
  const [form, setForm] = useState({ type: "note", title: "", description: "", outcome: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onActivityCreate({ ...form, lead_id: leadId });
    setLoading(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-slate-50 rounded-lg">
      <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
        <SelectTrigger className="bg-white">
          <SelectValue placeholder="Activity type" />
        </SelectTrigger>
        <SelectContent>
          {activityTypeOptions.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        required
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      <Textarea
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="bg-white text-sm"
        rows={2}
      />
      <Select value={form.outcome} onValueChange={(v) => setForm({ ...form, outcome: v })}>
        <SelectTrigger className="bg-white">
          <SelectValue placeholder="Outcome (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="positive">Positive</SelectItem>
          <SelectItem value="neutral">Neutral</SelectItem>
          <SelectItem value="negative">Negative</SelectItem>
          <SelectItem value="no_response">No Response</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading} className="bg-slate-900 hover:bg-slate-800">
          {loading ? "Saving..." : "Save Activity"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

export default function LeadDetails({ open, onClose, lead, activities = [], onEdit, onDelete, onActivityCreate, onUpdateLead }) {
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchResult, setResearchResult] = useState(null);

  if (!lead) return null;

  const initials = `${lead.first_name?.[0] || ''}${lead.last_name?.[0] || ''}`.toUpperCase();
  const leadActivities = activities.filter(a => a.lead_id === lead.id)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  const handleStatusChange = (newStatus) => {
    if (onUpdateLead) {
      onUpdateLead({ ...lead, status: newStatus });
    }
  };

  const handleResearch = async () => {
    setResearchLoading(true);
    setResearchResult(null);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Research this lead and provide a comprehensive sales intelligence brief:
Name: ${lead.first_name} ${lead.last_name}
Job Title: ${lead.job_title || 'Unknown'}
Company: ${lead.company_name}
Website: ${lead.website || 'Unknown'}
LinkedIn: ${lead.linkedin_url || 'Unknown'}
Industry: ${lead.industry || 'Unknown'}

Please provide:
1. Company overview and recent news
2. Potential plastic injection mold / manufacturing needs
3. Key talking points for outreach
4. Recommended approach

Keep it concise and actionable.`,
        add_context_from_internet: true
      });
      setResearchResult(result);
    } catch (e) {
      setResearchResult("Could not fetch research data. Please try again.");
    }
    setResearchLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0" side="right">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14">
                <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold">{lead.first_name} {lead.last_name}</h2>
                <p className="text-slate-300 text-sm">{lead.job_title}</p>
                <p className="text-slate-400 text-sm font-medium mt-0.5">{lead.company_name}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => onEdit(lead)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-300 hover:bg-white/10" onClick={() => { onClose(); onDelete(lead); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select value={lead.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-36 h-8 bg-white/10 border-white/20 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lead.priority && (
              <Badge className="bg-white/10 text-white border-white/20 text-xs">
                {lead.priority} priority
              </Badge>
            )}
            {lead.estimated_value && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs">
                ${lead.estimated_value.toLocaleString()}
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <Tabs defaultValue="info" className="flex-1">
          <TabsList className="w-full rounded-none border-b bg-white px-4 justify-start gap-0 h-auto p-0">
            <TabsTrigger value="info" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent py-3 px-4 text-sm">Info</TabsTrigger>
            <TabsTrigger value="activities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent py-3 px-4 text-sm">
              Activities {leadActivities.length > 0 && `(${leadActivities.length})`}
            </TabsTrigger>
            <TabsTrigger value="research" className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent py-3 px-4 text-sm">AI Research</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="p-4 space-y-4 mt-0">
            {/* Contact */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Contact</h3>
              <div className="space-y-2">
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-teal-600 transition-colors">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {lead.email}
                  </a>
                )}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-teal-600 transition-colors">
                    <Phone className="w-4 h-4 text-slate-400" />
                    {lead.phone}
                  </a>
                )}
                {lead.linkedin_url && (
                  <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-700 hover:text-teal-600 transition-colors">
                    <Linkedin className="w-4 h-4 text-slate-400" />
                    LinkedIn Profile
                  </a>
                )}
                {lead.location && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {lead.location}
                  </div>
                )}
              </div>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Company</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  {lead.company_name}
                  {lead.company_size && <span className="text-slate-400">· {lead.company_size} employees</span>}
                </div>
                {lead.industry && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-slate-400 text-xs">Industry:</span>
                    {lead.industry}
                  </div>
                )}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-700 hover:text-teal-600 transition-colors">
                    <Globe className="w-4 h-4 text-slate-400" />
                    {lead.website}
                  </a>
                )}
              </div>
            </div>

            {/* Deal */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Deal</h3>
              <div className="space-y-2">
                {lead.estimated_value && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    ${lead.estimated_value.toLocaleString()}
                  </div>
                )}
                {lead.source && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-slate-400 text-xs">Source:</span>
                    {lead.source.replace('_', ' ')}
                  </div>
                )}
                {lead.next_follow_up && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Follow up: {format(new Date(lead.next_follow_up), 'MMM d, yyyy')}
                  </div>
                )}
                {lead.last_contacted && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Last contacted: {format(new Date(lead.last_contacted), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            {lead.tags?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {lead.notes && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Notes</h3>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="p-4 mt-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Activity History</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddActivity(!showAddActivity)}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Activity
              </Button>
            </div>

            {showAddActivity && (
              <div className="mb-4">
                <AddActivityForm
                  leadId={lead.id}
                  onActivityCreate={onActivityCreate}
                  onClose={() => setShowAddActivity(false)}
                />
              </div>
            )}

            {leadActivities.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activities yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {leadActivities.map(activity => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* AI Research Tab */}
          <TabsContent value="research" className="p-4 mt-0">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">AI Sales Intelligence</h3>
              <p className="text-xs text-slate-500">Get an AI-powered research brief on this lead and company.</p>
            </div>

            <Button
              onClick={handleResearch}
              disabled={researchLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 mb-4"
            >
              <Search className="w-4 h-4 mr-2" />
              {researchLoading ? "Researching..." : "Research This Lead"}
            </Button>

            {researchLoading && (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-4 bg-slate-100 rounded w-full" />
                <div className="h-4 bg-slate-100 rounded w-5/6" />
                <div className="h-4 bg-slate-100 rounded w-2/3" />
              </div>
            )}

            {researchResult && !researchLoading && (
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {researchResult}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}