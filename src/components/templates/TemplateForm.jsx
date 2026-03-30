import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export default function TemplateForm({ template, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: template?.name || "",
    stage: template?.stage || "new",
    language: template?.language || "english",
    type: template?.type || "email",
    subject: template?.subject || "",
    body: template?.body || "",
    notes: template?.notes || "",
    icp_type: template?.icp_type || "",
    buyer_role: template?.buyer_role || "",
    industry: template?.industry || "",
    pain_point: template?.pain_point || "",
    trigger_event: template?.trigger_event || "",
    offer_type: template?.offer_type || "",
    cta_type: template?.cta_type || "",
    funnel_stage: template?.funnel_stage || "",
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      template
        ? base44.entities.EmailTemplate.update(template.id, data)
        : base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_templates"] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) return;
    mutation.mutate(form);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800">{template ? "Edit Template" : "New Template"}</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <Input
        placeholder="Template name (e.g. Initial Outreach EN)"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />

      <div className="grid grid-cols-3 gap-3">
        <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
          <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New Lead</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="proposal">Proposal Sent</SelectItem>
            <SelectItem value="negotiation">Negotiation</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>

        <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
          <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="english">🇺🇸 English</SelectItem>
            <SelectItem value="spanish">🇪🇸 Spanish</SelectItem>
          </SelectContent>
        </Select>

        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="email">✉️ Email</SelectItem>
            <SelectItem value="call_script">📞 Call Script</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.type === "email" && (
        <Input
          placeholder="Subject line (e.g. Plastic Injection Molds — Top Quality Supplier)"
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
        />
      )}

      <textarea
        className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-800 min-h-[220px] resize-y focus:outline-none focus:ring-2 focus:ring-slate-300"
        placeholder={
          form.type === "email"
            ? "Email body... Use {{first_name}}, {{company_name}}, {{mold_type}} as placeholders."
            : "Call script... Use [PAUSE], [LISTEN], {{first_name}} as guides."
        }
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        required
      />

      {/* Playbook fields */}
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="ICP Type (e.g. OEM Manufacturer)" value={form.icp_type} onChange={(e) => setForm({ ...form, icp_type: e.target.value })} />
        <Input placeholder="Buyer Role (e.g. Procurement Manager)" value={form.buyer_role} onChange={(e) => setForm({ ...form, buyer_role: e.target.value })} />
        <Input placeholder="Pain Point addressed" value={form.pain_point} onChange={(e) => setForm({ ...form, pain_point: e.target.value })} />
        <Input placeholder="CTA Type (e.g. Schedule Call)" value={form.cta_type} onChange={(e) => setForm({ ...form, cta_type: e.target.value })} />
        <Input placeholder="Offer Type (e.g. Free Sample)" value={form.offer_type} onChange={(e) => setForm({ ...form, offer_type: e.target.value })} />
        <Input placeholder="Trigger Event (e.g. New product launch)" value={form.trigger_event} onChange={(e) => setForm({ ...form, trigger_event: e.target.value })} />
      </div>

      <Input
        placeholder="Usage notes (optional)"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending}
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          {mutation.isPending ? "Saving..." : template ? "Update Template" : "Save Template"}
        </Button>
      </div>
    </form>
  );
}