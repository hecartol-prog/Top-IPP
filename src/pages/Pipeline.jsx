import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import PipelineBoard from "../components/pipeline/PipelineBoard";
import LeadDetails from "@/components/leads/LeadDetails.jsx";
import LeadForm from "../components/leads/LeadForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Pipeline() {
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingLead, setDeletingLead] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date')
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list('-created_date')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setEditingLead(null);
      setShowForm(false);
      setSelectedLead(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setDeletingLead(null);
      setSelectedLead(null);
    }
  });

  const createActivityMutation = useMutation({
    mutationFn: (data) => base44.entities.Activity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  });

  const SPANISH_DOMAINS = ["mx", "ar", "co", "es", "cl", "pe", "ve", "ec", "bo", "py", "uy", "gt", "sv", "hn", "ni", "cr", "do", "cu", "pr"];
  const isSpanishLead = (lead) => {
    if (lead.language === "spanish") return true;
    const emailDomain = (lead.email || "").split("@")[1]?.split(".").pop()?.toLowerCase();
    return SPANISH_DOMAINS.includes(emailDomain);
  };

  const getAutoTasks = (lead) => {
    const es = isSpanishLead(lead);
    return {
      contacted: { title: es ? "Enviar email de presentaci\u00f3n + Ficha T\u00e9cnica de Molde" : "Send intro email + Mold Spec Sheet", type: "send_document", hoursUntilDue: 24, priority: "high" },
      qualified: { title: es ? "Agendar llamada de descubrimiento" : "Schedule discovery call — request mold specs", type: "schedule_meeting", hoursUntilDue: 48, priority: "high" },
      proposal: { title: es ? "Seguimiento a cotizaci\u00f3n enviada" : "Follow up on quote sent (3-day check-in)", type: "follow_up", hoursUntilDue: 72, priority: "urgent" },
      negotiation: { title: es ? "Llamada para aclarar objeciones y ajustar oferta" : "Call to clarify concerns & send revised offer", type: "call", hoursUntilDue: 48, priority: "urgent" },
      won: { title: es ? "Cobrar anticipo y enviar contrato" : "Collect deposit & send signed contract", type: "email", hoursUntilDue: 24, priority: "urgent" },
      lost: { title: es ? "Registrar motivo de p\u00e9rdida y programar reactivaci\u00f3n" : "Log loss reason & schedule 90-day reactivation", type: "follow_up", hoursUntilDue: 168, priority: "low" },
    };
  };

  const handleStatusChange = (lead, newStatus) => {
    updateMutation.mutate({
      id: lead.id,
      data: { ...lead, status: newStatus }
    });

    // Auto-create activity for status change
    createActivityMutation.mutate({
      lead_id: lead.id,
      type: "note",
      title: `Status changed to ${newStatus}`,
      description: `Lead moved from ${lead.status} to ${newStatus}`
    });

    // Auto-generate next task for the new stage
    const autoTask = getAutoTasks(lead)[newStatus];
    if (autoTask) {
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + autoTask.hoursUntilDue);
      createTaskMutation.mutate({
        lead_id: lead.id,
        title: autoTask.title,
        type: autoTask.type,
        priority: autoTask.priority,
        due_date: dueDate.toISOString(),
        auto_generated: true,
        stage_trigger: newStatus,
        completed: false,
      });
    }
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setShowForm(true);
    setSelectedLead(null);
  };

  const handleDelete = (lead) => {
    setDeletingLead(lead);
  };

  const confirmDelete = () => {
    if (deletingLead) {
      deleteMutation.mutate(deletingLead.id);
    }
  };

  // Calculate pipeline stats
  const STAGE_PROBS = { new: 5, contacted: 5, qualified: 20, proposal: 50, negotiation: 80, won: 100, lost: 0 };
  const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
  const weightedTotal = leads.reduce((sum, lead) => {
    const prob = STAGE_PROBS[lead.status] || 0;
    return sum + Math.round((lead.estimated_value || 0) * prob / 100);
  }, 0);
  const activeDeals = leads.filter(l => !['won', 'lost'].includes(l.status)).length;

  // Stall detection: deals not updated in 10+ days
  const stalledDeals = leads.filter(l => {
    if (['won', 'lost', 'new'].includes(l.status)) return false;
    const updated = l.updated_date ? new Date(l.updated_date) : null;
    if (!updated) return false;
    const daysSince = Math.floor((new Date() - updated) / (1000 * 60 * 60 * 24));
    return daysSince >= 10;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-slate-900 tracking-tight"
            >
              Pipeline
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-slate-500 mt-1"
            >
              Drag and drop leads to update their status
            </motion.p>
          </div>
          <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
            <div className="text-right">
              <p className="text-xs sm:text-sm text-slate-500">Active Deals</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{activeDeals}</p>
            </div>
            <div className="text-right">
              <p className="text-xs sm:text-sm text-slate-500">Total Pipeline</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600">${totalValue.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs sm:text-sm text-slate-500">Weighted Forecast</p>
              <p className="text-xl sm:text-2xl font-bold text-teal-600">${weightedTotal.toLocaleString()}</p>
            </div>
            {stalledDeals.length > 0 && (
              <div className="text-right">
                <p className="text-xs sm:text-sm text-amber-500">Stalled Deals</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-600">{stalledDeals.length}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Board */}
        {isLoading ? (
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="w-72 flex-shrink-0">
                <div className="h-8 bg-slate-200 rounded mb-3 animate-pulse" />
                <div className="h-[500px] bg-slate-100 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <PipelineBoard
              leads={leads}
              onLeadClick={setSelectedLead}
              onStatusChange={handleStatusChange}
            />
          </motion.div>
        )}
      </div>

      {/* Lead Details Sheet */}
      <LeadDetails
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        lead={selectedLead}
        activities={activities}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onActivityCreate={(data) => createActivityMutation.mutate(data)}
      />

      {/* Lead Form Modal */}
      <LeadForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingLead(null); }}
        lead={editingLead}
        onSave={(data) => updateMutation.mutate({ id: editingLead?.id, data })}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingLead} onOpenChange={() => setDeletingLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingLead?.first_name} {deletingLead?.last_name}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}