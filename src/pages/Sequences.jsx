import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Zap, Users, Play, Pause, Trash2, Mail, Linkedin, ChevronRight, Edit } from "lucide-react";

const DEFAULT_STEPS = [
  { step_number: 1, channel: "email", delay_days: 0,  label: "Intro Email",      body: "" },
  { step_number: 2, channel: "email", delay_days: 4,  label: "Follow-up",        body: "" },
  { step_number: 3, channel: "email", delay_days: 9,  label: "Case Study",       body: "" },
  { step_number: 4, channel: "email", delay_days: 16, label: "Breakup Message",  body: "" },
];

function CampaignForm({ campaign, onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(campaign?.name || "");
  const [targetIndustry, setTargetIndustry] = useState(campaign?.target_industry || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [steps, setSteps] = useState(campaign?.steps?.length ? campaign.steps : DEFAULT_STEPS);
  const [saving, setSaving] = useState(false);

  const updateStep = (idx, field, value) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addStep = () => {
    const lastDelay = steps[steps.length - 1]?.delay_days || 0;
    setSteps((prev) => [...prev, { step_number: prev.length + 1, channel: "email", delay_days: lastDelay + 7, label: "New Step", body: "" }]);
  };

  const removeStep = (idx) => setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_number: i + 1 })));

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const data = { name, target_industry: targetIndustry, description, steps, status: campaign?.status || "active" };
    if (campaign?.id) {
      await base44.entities.OutreachCampaign.update(campaign.id, data);
    } else {
      await base44.entities.OutreachCampaign.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ["outreach-campaigns"] });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Edit Campaign" : "New Outreach Campaign"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaign Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="e.g. Automotive Cold Outreach" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Target Industry</label>
              <Input value={targetIndustry} onChange={(e) => setTargetIndustry(e.target.value)} className="mt-1" placeholder="e.g. Automotive, Medical" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" placeholder="Campaign goal and ICP" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sequence Steps</label>
              <Button type="button" size="sm" variant="outline" onClick={addStep} className="gap-1.5 text-xs h-7">
                <Plus className="w-3 h-3" /> Add Step
              </Button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {step.step_number}
                  </div>
                  <Input
                    value={step.label}
                    onChange={(e) => updateStep(idx, "label", e.target.value)}
                    className="h-8 text-sm flex-1"
                    placeholder="Step name"
                  />
                  <Select value={step.channel} onValueChange={(v) => updateStep(idx, "channel", v)}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-slate-400">Day</span>
                    <Input
                      type="number"
                      value={step.delay_days}
                      onChange={(e) => updateStep(idx, "delay_days", parseInt(e.target.value) || 0)}
                      className="w-14 h-8 text-xs text-center"
                    />
                  </div>
                  {steps.length > 1 && (
                    <button type="button" onClick={() => removeStep(idx)} className="text-slate-300 hover:text-rose-500 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 bg-violet-600 hover:bg-violet-700">
              {saving ? "Saving..." : campaign ? "Update Campaign" : "Create Campaign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Sequences() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["outreach-campaigns"],
    queryFn: () => base44.entities.OutreachCampaign.list("-created_date"),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list(),
  });

  const toggleStatus = async (campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await base44.entities.OutreachCampaign.update(campaign.id, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["outreach-campaigns"] });
  };

  const deleteCampaign = async (id) => {
    await base44.entities.OutreachCampaign.delete(id);
    queryClient.invalidateQueries({ queryKey: ["outreach-campaigns"] });
  };

  const getEnrolledCount = (campaign) => {
    return leads.filter((l) => l.sequence_id === campaign.id).length;
  };

  const statusColors = {
    active: "bg-emerald-100 text-emerald-700",
    paused: "bg-amber-100 text-amber-700",
    completed: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Outreach Sequences</h1>
            <p className="text-sm text-slate-500 mt-0.5">Multi-step automated outreach campaigns</p>
          </div>
          <Button onClick={() => { setEditingCampaign(null); setShowForm(true); }} className="bg-violet-600 hover:bg-violet-700 gap-2">
            <Plus className="w-4 h-4" /> New Campaign
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <Zap className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Active Campaigns</p>
                <p className="text-xl font-bold text-slate-900">{campaigns.filter((c) => c.status === "active").length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Enrolled</p>
                <p className="text-xl font-bold text-slate-900">{leads.filter((l) => l.sequence_id).length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <Mail className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Campaigns</p>
                <p className="text-xl font-bold text-slate-900">{campaigns.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign List */}
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />)}</div>
        ) : campaigns.length === 0 ? (
          <Card className="bg-white border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Zap className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-500">No campaigns yet</p>
              <p className="text-sm text-slate-400 mt-1">Create your first outreach sequence to start automating follow-ups</p>
              <Button onClick={() => setShowForm(true)} className="mt-4 bg-violet-600 hover:bg-violet-700 gap-2">
                <Plus className="w-4 h-4" /> Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const enrolled = getEnrolledCount(campaign);
              return (
                <Card key={campaign.id} className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                          <Badge className={`${statusColors[campaign.status]} border-0 text-xs`}>
                            {campaign.status}
                          </Badge>
                          {campaign.target_industry && (
                            <Badge variant="outline" className="text-xs">{campaign.target_industry}</Badge>
                          )}
                        </div>
                        {campaign.description && (
                          <p className="text-sm text-slate-500 mt-0.5 truncate">{campaign.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          <span><strong className="text-slate-700">{campaign.steps?.length || 4}</strong> steps</span>
                          <span><strong className="text-slate-700">{enrolled}</strong> enrolled</span>
                          {campaign.reply_count > 0 && (
                            <span><strong className="text-slate-700">{campaign.reply_count}</strong> replies</span>
                          )}
                        </div>
                        {/* Steps preview */}
                        {campaign.steps?.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {campaign.steps.map((step, i) => (
                              <React.Fragment key={i}>
                                <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                  {step.channel === "linkedin" ? <Linkedin className="w-2.5 h-2.5" /> : <Mail className="w-2.5 h-2.5" />}
                                  Day {step.delay_days}
                                </span>
                                {i < campaign.steps.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleStatus(campaign)}
                          className={`p-2 rounded-lg transition-colors ${
                            campaign.status === "active"
                              ? "text-amber-600 hover:bg-amber-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={campaign.status === "active" ? "Pause" : "Activate"}
                        >
                          {campaign.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingCampaign(campaign); setShowForm(true); }}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCampaign(campaign.id)}
                          className="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <CampaignForm
          campaign={editingCampaign}
          onClose={() => { setShowForm(false); setEditingCampaign(null); }}
        />
      )}
    </div>
  );
}