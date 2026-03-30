import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, format } from "date-fns";
import { Zap, CheckCircle2, RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_STEPS = [
  { step_number: 1, channel: "email", delay_days: 0,  label: "Step 1 — Intro Email",       description: "Day 0: First contact" },
  { step_number: 2, channel: "email", delay_days: 4,  label: "Step 2 — Follow-up",          description: "Day 4: Check-in" },
  { step_number: 3, channel: "email", delay_days: 9,  label: "Step 3 — Case Study",         description: "Day 9: Value proof" },
  { step_number: 4, channel: "email", delay_days: 16, label: "Step 4 — Breakup Message",    description: "Day 16: Last attempt" },
];

export default function AddToSequenceDialog({ open, onClose, lead }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: campaigns = [] } = useQuery({
    queryKey: ["outreach-campaigns"],
    queryFn: () => base44.entities.OutreachCampaign.list(),
    enabled: open,
  });

  const activeCampaigns = campaigns.filter((c) => c.status === "active" || c.status === "paused");

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const steps = selectedCampaign?.steps?.length ? selectedCampaign.steps : DEFAULT_STEPS;

  const handleEnroll = async () => {
    if (!lead) return;
    setEnrolling(true);

    const now = new Date();
    const firstSend = addDays(now, steps[0]?.delay_days || 0);

    // Update lead with sequence info
    await base44.entities.Lead.update(lead.id, {
      sequence_id: selectedCampaignId || "default",
      sequence_step: 1,
      sequence_next_send: firstSend.toISOString(),
      temperature: lead.temperature === "cold" ? "warm" : lead.temperature,
    });

    // Create task for step 1
    const taskDue = new Date();
    taskDue.setHours(taskDue.getHours() + 1);
    await base44.entities.Task.create({
      lead_id: lead.id,
      title: `[Sequence] Step 1 — Send intro to ${lead.first_name} ${lead.last_name}`,
      type: "email",
      priority: "high",
      due_date: taskDue.toISOString(),
      auto_generated: true,
      completed: false,
      notes: `Part of ${selectedCampaign?.name || "Default"} sequence.`,
    });

    // Update campaign enrolled count
    if (selectedCampaignId) {
      await base44.entities.OutreachCampaign.update(selectedCampaignId, {
        enrolled_count: (selectedCampaign?.enrolled_count || 0) + 1,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["outreach-campaigns"] });

    setEnrolling(false);
    setDone(true);
    setTimeout(() => { onClose(); setDone(false); setSelectedCampaignId(""); }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); setDone(false); setSelectedCampaignId(""); }}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-violet-500" />
            Add to Sequence
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-semibold text-slate-800">{lead?.first_name} enrolled!</p>
            <p className="text-sm text-slate-500">Task created for Step 1. Sequence is active.</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-sm text-slate-600 mb-1">
                Enrolling: <strong>{lead?.first_name} {lead?.last_name}</strong> — {lead?.company_name}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Campaign</label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Default 4-step sequence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Default 4-step sequence</SelectItem>
                  {activeCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Sequence Steps
              </div>
              <div className="divide-y divide-slate-100">
                {steps.map((step, i) => (
                  <div key={i} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {step.step_number || i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{step.label || `Step ${i + 1}`}</p>
                      <p className="text-xs text-slate-400">{step.description || `Day ${step.delay_days}: ${step.channel}`}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      Day {step.delay_days}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
              <Button
                type="button"
                onClick={handleEnroll}
                disabled={enrolling}
                className="flex-1 bg-violet-600 hover:bg-violet-700"
              >
                {enrolling
                  ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Enrolling...</>
                  : <><Zap className="w-4 h-4 mr-2" />Enroll in Sequence</>
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}