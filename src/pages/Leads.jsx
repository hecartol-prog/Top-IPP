import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, Upload, Globe, Trash2, Search, Download, Zap, Copy, Edit3, ClipboardPaste, MessageCircle } from "lucide-react";
import BulkWhatsAppScan from "../components/leads/BulkWhatsAppScan";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";
import LeadCard from "../components/leads/LeadCard";
import LeadForm from "../components/leads/LeadForm";
import LeadDetails from "@/components/leads/LeadDetails.jsx";
import LeadCSVImport from "../components/leads/CSVImport";
import WebScraper from "../components/leads/WebScraper";
import LeadListView from "../components/leads/LeadListView";
import LeadFilterBar, { applyFilters } from "../components/leads/LeadFilterBar";
import BatchEnrichDialog from "../components/leads/BatchEnrichDialog";
import BatchEditDialog from "../components/leads/BatchEditDialog";
import DuplicateChecker from "../components/leads/DuplicateChecker";
import PasteLeadDialog from "../components/leads/PasteLeadDialog";
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

export default function Leads() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    source: "all",
    priority: "all",
    companySize: "all",
    enrichment: "all",
    contacted: "all",
    language: "all",
    country: "",
    industry: "",
    jobTitle: "",
    companyName: "",
    hasEmail: "all",
    hasPhone: "all",
    hasWebsite: "all",
    minValue: "",
    maxValue: "",
    sortField: "created_date",
    sortDir: "desc",
  });
  const [viewMode, setViewMode] = useState("grid");
  const [selectedIds, setSelectedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showScraper, setShowScraper] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [deletingLead, setDeletingLead] = useState(null);
  const [showBatchEnrich, setShowBatchEnrich] = useState(false);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pastedLeadData, setPastedLeadData] = useState(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showBulkWhatsApp, setShowBulkWhatsApp] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 10000)
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list('-created_date')
  });

  // Check URL params for actions
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      setShowForm(true);
    }
    if (params.get('id')) {
      const lead = leads.find(l => l.id === params.get('id'));
      if (lead) setSelectedLead(lead);
    }
  }, [leads]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setShowForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: (updatedLead, { keepDetailsOpen, data }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setEditingLead(null);
      if (!keepDetailsOpen) {
        setSelectedLead(null);
      } else if (data) {
        setSelectedLead(prev => prev ? { ...prev, ...data } : prev);
      }
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

  const handleSave = (data) => {
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data });
    } else {
      createMutation.mutate(data);
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

  // Bulk delete
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => { for (const id of ids) await base44.entities.Lead.delete(id); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setSelectedIds([]); }
  });

  const toggleSelectId = (id) => setSelectedIds(prev =>
    prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
  );
  const toggleSelectAll = () => {
    const filteredIds = filteredLeads.map(l => l.id);
    const allFilteredSelected = filteredIds.every(id => selectedIds.includes(id));
    if (allFilteredSelected) {
      // Deselect only the filtered ones (keep any outside the filter selected)
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered leads (merge with existing)
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const filteredLeads = applyFilters(leads, filters);
  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change
  React.useEffect(() => { setCurrentPage(1); }, [filters]);

  const handleExportExcel = () => {
    const leadsToExport = selectedIds.length > 0
      ? filteredLeads.filter(l => selectedIds.includes(l.id))
      : filteredLeads;

    const rows = leadsToExport.map(l => ({
      "First Name": l.first_name || "",
      "Last Name": l.last_name || "",
      "Email": l.email || "",
      "Phone": l.phone || "",
      "Job Title": l.job_title || "",
      "Company": l.company_name || "",
      "Company Size": l.company_size || "",
      "Industry": l.industry || "",
      "Website": l.website || "",
      "Location": l.location || "",
      "Country": l.country || "",
      "Status": l.status || "",
      "Priority": l.priority || "",
      "Source": l.source || "",
      "Language": l.language || "",
      "LinkedIn": l.linkedin_url || "",
      "Estimated Value": l.estimated_value || "",
      "Tags": (l.tags || []).join(", "),
      "Notes": l.notes || "",
      "Next Follow Up": l.next_follow_up || "",
      "Last Contacted": l.last_contacted || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-slate-900 tracking-tight"
            >
              Leads
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-slate-500 mt-1"
            >
              Manage and track your prospective clients
            </motion.p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleExportExcel}
              variant="outline"
              size="sm"
              disabled={filteredLeads.length === 0}
              title="Export leads"
            >
              <Download className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">
                {selectedIds.length > 0 ? `Export ${selectedIds.length}` : `Export ${filteredLeads.length}`}
              </span>
            </Button>
            <Button
              onClick={() => setShowDuplicates(true)}
              variant="outline"
              size="sm"
              title="Check Duplicates"
            >
              <Copy className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Duplicates</span>
            </Button>
            <Button 
              onClick={() => setShowScraper(true)}
              variant="outline"
              size="sm"
              title="Scrape Website"
            >
              <Globe className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Scrape</span>
            </Button>
            <Button 
              onClick={() => setShowImport(true)}
              variant="outline"
              size="sm"
              title="Import CSV"
            >
              <Upload className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Import</span>
            </Button>
            <Button
              onClick={() => setShowPaste(true)}
              variant="outline"
              size="sm"
              title="Paste Lead Info"
            >
              <ClipboardPaste className="w-4 h-4 sm:mr-2" />
              <span className="hidden lg:inline">Paste Lead</span>
            </Button>
            <Button 
              onClick={() => { setEditingLead(null); setPastedLeadData(null); setShowForm(true); }}
              className="bg-slate-900 hover:bg-slate-800"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1 sm:mr-2" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <LeadFilterBar
            filters={filters}
            onChange={setFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            totalCount={leads.length}
            filteredCount={filteredLeads.length}
          />
        </motion.div>

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm font-medium text-slate-700">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setShowBatchEdit(true)}
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                Edit {selectedIds.length}
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => setShowBatchEnrich(true)}
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                Enrich {selectedIds.length} with AI
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setShowBulkWhatsApp(true)}
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                WhatsApp Scan
              </Button>
              <Button variant="destructive" size="sm" onClick={() => bulkDeleteMutation.mutate(selectedIds)} disabled={bulkDeleteMutation.isPending}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete {selectedIds.length}
              </Button>
            </div>
          </div>
        )}

        {/* Leads Grid / List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No leads found</h3>
            <p className="text-slate-500 mb-4">Try adjusting your filters or add a new lead</p>
            <Button onClick={() => { setEditingLead(null); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </div>
        ) : viewMode === "list" ? (
          <div
            className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 320px)", minHeight: "300px" }}
          >
            <LeadListView
              leads={paginatedLeads}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectId}
              onToggleAll={toggleSelectAll}
              onEdit={(lead) => handleEdit(lead)}
              onDelete={(lead) => handleDelete(lead)}
              onRowClick={(lead) => setSelectedLead(lead)}
              embedded
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {paginatedLeads.map((lead, index) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <LeadCard
                    lead={lead}
                    onClick={() => setSelectedLead(lead)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length} leads
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) => p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-sm">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={currentPage === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(p)}
                    className="min-w-[36px]"
                  >
                    {p}
                  </Button>
                ))
              }
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Web Scraper Modal */}
      <Dialog open={showScraper} onOpenChange={setShowScraper}>
        <DialogContent className="max-w-2xl bg-white">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5" /> Scrape Leads from Website
            </h2>
            <p className="text-sm text-slate-500 mt-1">Enter a team page, directory, or any page with contact info</p>
          </div>
          <WebScraper onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setShowScraper(false);
          }} />
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-lg bg-white">
          <LeadCSVImport onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setShowImport(false);
          }} />
        </DialogContent>
      </Dialog>

      {/* Paste Lead Dialog */}
      <PasteLeadDialog
        open={showPaste}
        onClose={() => setShowPaste(false)}
        onParsed={(data) => {
          setPastedLeadData(data);
          setEditingLead(null);
          setShowForm(true);
        }}
      />

      {/* Lead Form Modal */}
      <LeadForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingLead(null); setPastedLeadData(null); }}
        lead={editingLead || pastedLeadData}
        onSave={handleSave}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Lead Details Sheet */}
      <LeadDetails
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        lead={selectedLead}
        activities={activities}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onActivityCreate={(data) => createActivityMutation.mutate(data)}
        onUpdateLead={(updatedLead) => updateMutation.mutate({ id: updatedLead.id, data: updatedLead, keepDetailsOpen: true })}
      />

      {/* Duplicate Checker */}
      <DuplicateChecker
        open={showDuplicates}
        onClose={() => setShowDuplicates(false)}
        leads={leads}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
      />

      {/* Batch Edit Dialog */}
      <BatchEditDialog
        open={showBatchEdit}
        onClose={() => setShowBatchEdit(false)}
        leads={filteredLeads.filter(l => selectedIds.includes(l.id))}
        onComplete={() => { queryClient.invalidateQueries({ queryKey: ['leads'] }); setSelectedIds([]); setShowBatchEdit(false); }}

      />

      {/* Bulk WhatsApp Scan */}
      <BulkWhatsAppScan
        open={showBulkWhatsApp}
        onClose={() => setShowBulkWhatsApp(false)}
        leads={selectedIds.length > 0 ? filteredLeads.filter(l => selectedIds.includes(l.id)) : filteredLeads}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
      />

      {/* Batch Enrich Dialog */}
      <BatchEnrichDialog
        open={showBatchEnrich}
        onClose={() => setShowBatchEnrich(false)}
        leads={filteredLeads.filter(l => selectedIds.includes(l.id))}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
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