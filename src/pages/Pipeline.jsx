import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import PipelineBoard from "../components/pipeline/PipelineBoard";
import LeadDetails from "../components/leads/LeadDetails";
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
  const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
  const activeDeals = leads.filter(l => !['won', 'lost'].includes(l.status)).length;

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
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm text-slate-500">Active Deals</p>
              <p className="text-2xl font-bold text-slate-900">{activeDeals}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Total Pipeline</p>
              <p className="text-2xl font-bold text-emerald-600">${totalValue.toLocaleString()}</p>
            </div>
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