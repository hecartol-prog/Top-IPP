import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, Phone, Linkedin, Globe, Building2, MapPin, Calendar, 
  DollarSign, Edit2, Trash2, MessageSquare, PhoneCall, Video,
  FileText, Send, Clock, CheckCircle2, X, Search
} from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import LeadResearchPanel from "./LeadResearchPanel";

const statusColors = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-purple-100 text-purple-700",
  qualified: "bg-amber-100 text-amber-700",
  proposal: "bg-cyan-100 text-cyan-700",
  negotiation: "bg-orange-100 text-orange-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-slate-100 text-slate-700"
};

const activityTypes = [
  { value: "call", label: "Call", icon: PhoneCall },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Video },
  { value: "note", label: "Note", icon: FileText },
  { value: "linkedin_message", label: "LinkedIn Message", icon: Linkedin },
  { value: "proposal_sent", label: "Proposal Sent", icon: Send },
  { value: "follow_up", label: "Follow Up", icon: Clock }
];

export default function LeadDetails({ 
  open, 
  onClose, 
  lead, 
  activities = [], 
  onEdit, 
  onDelete,
  onActivityCreate,
  onRefresh,
  onUpdateLead
}) {
  const [activityForm, setActivityForm] = useState({
    type: "note",
    title: "",
    description: ""
  });
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [showResearch, setShowResearch] = useState(false);

  if (!lead) return null;

  const initials = `${lead.first_name?.[0] || ''}${lead.last_name?.[0] || ''}`.toUpperCase();

  const handleAddActivity = async () => {
    if (!activityForm.title.trim()) return;
    
    await onActivityCreate({
      lead_id: lead.id,
      ...activityForm
    });
    
    setActivityForm({ type: "note", title: "", description: "" });
    setIsAddingActivity(false);
  };

  const leadActivities = activities.filter(a => a.lead_id === lead.id);

  return (
    <>
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white">
        <SheetHeader className="pb-6 border-b pr-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-900">
                <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-xl font-bold text-slate-900">
                  {lead.first_name} {lead.last_name}
                </SheetTitle>
                <p className="text-slate-500">{lead.job_title}</p>
                <Badge className={`${statusColors[lead.status]} mt-2`}>
                  {lead.status?.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => onEdit(lead)}>
              <Edit2 className="w-4 h-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => onDelete(lead)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setShowResearch(true)}>
              <Search className="w-4 h-4 mr-1" /> AI Research
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-6">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-4">
            {/* Contact Info */}
            <Card className="p-4 space-y-3 bg-slate-50 border-0">
              <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Contact</h4>
              
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-teal-600 transition-colors">
                  <Mail className="w-4 h-4" />
                  {lead.email}
                </a>
              )}
              
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="flex items-center gap-3 text-sm text-slate-600 hover:text-teal-600 transition-colors">
                  <Phone className="w-4 h-4" />
                  {lead.phone}
                </a>
              )}
              
              {lead.linkedin_url && (
                <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-slate-600 hover:text-teal-600 transition-colors">
                  <Linkedin className="w-4 h-4" />
                  LinkedIn Profile
                </a>
              )}
              
              {lead.location && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  {lead.location}
                </div>
              )}
            </Card>

            {/* Company Info */}
            <Card className="p-4 space-y-3 bg-slate-50 border-0">
              <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Company</h4>
              
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Building2 className="w-4 h-4" />
                {lead.company_name}
                {lead.company_size && <span className="text-slate-400">• {lead.company_size} employees</span>}
              </div>
              
              {lead.industry && (
                <div className="text-sm text-slate-600 pl-7">
                  Industry: {lead.industry}
                </div>
              )}
              
              {lead.website && (
                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-slate-600 hover:text-teal-600 transition-colors">
                  <Globe className="w-4 h-4" />
                  {lead.website}
                </a>
              )}
            </Card>

            {/* Deal Info */}
            <Card className="p-4 space-y-3 bg-slate-50 border-0">
              <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide">Deal</h4>
              
              {lead.estimated_value && (
                <div className="flex items-center gap-3 text-sm font-semibold text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                  ${lead.estimated_value.toLocaleString()} estimated value
                </div>
              )}
              
              <div className="text-sm text-slate-600">
                <span className="font-medium">Source:</span> {lead.source?.replace('_', ' ')}
              </div>
              
              <div className="text-sm text-slate-600">
                <span className="font-medium">Priority:</span> {lead.priority}
              </div>
              
              {lead.next_follow_up && (
                <div className="flex items-center gap-3 text-sm text-amber-600">
                  <Calendar className="w-4 h-4" />
                  Follow up: {format(new Date(lead.next_follow_up), 'MMMM d, yyyy')}
                </div>
              )}
            </Card>

            {/* Notes */}
            {lead.notes && (
              <Card className="p-4 bg-slate-50 border-0">
                <h4 className="font-semibold text-slate-900 text-sm uppercase tracking-wide mb-2">Notes</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{lead.notes}</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            {/* Add Activity */}
            {!isAddingActivity ? (
              <Button 
                variant="outline" 
                className="w-full mb-4"
                onClick={() => setIsAddingActivity(true)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Log Activity
              </Button>
            ) : (
              <Card className="p-4 mb-4 space-y-3 border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Log Activity</h4>
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingActivity(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <Select 
                  value={activityForm.type} 
                  onValueChange={(v) => setActivityForm(prev => ({ ...prev, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  type="text"
                  placeholder="Activity title..."
                  value={activityForm.title}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                <Textarea
                  placeholder="Description (optional)"
                  value={activityForm.description}
                  onChange={(e) => setActivityForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />

                <Button 
                  className="w-full bg-slate-900 hover:bg-slate-800" 
                  onClick={handleAddActivity}
                  disabled={!activityForm.title.trim()}
                >
                  Save Activity
                </Button>
              </Card>
            )}

            {/* Activity Timeline */}
            <div className="space-y-3">
              {leadActivities.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No activities yet</p>
                </div>
              ) : (
                leadActivities.map(activity => {
                  const activityType = activityTypes.find(t => t.value === activity.type);
                  const Icon = activityType?.icon || MessageSquare;
                  
                  return (
                    <Card key={activity.id} className="p-3 border-slate-100">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-100">
                          <Icon className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm text-slate-900">{activity.title}</p>
                            {activity.completed && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                          </div>
                          {activity.description && (
                            <p className="text-sm text-slate-500 mt-1">{activity.description}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-2">
                            {format(new Date(activity.created_date), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>

    {/* Research Panel - separate window */}
    {showResearch && (
      <div className="fixed inset-0 z-[60] flex">
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowResearch(false)} />
        <div className="relative ml-auto w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
            <h2 className="font-semibold text-slate-900 text-sm">AI Research — {lead.company_name}</h2>
            <button onClick={() => setShowResearch(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            <LeadResearchPanel lead={lead} onUpdateLead={onUpdateLead} />
          </div>
        </div>
      </div>
    )}
    </>
  );
}