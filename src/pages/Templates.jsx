import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Phone, Globe, Copy, Check, Plus, Trash2, Languages } from "lucide-react";
import { motion } from "framer-motion";
import TemplateCard from "../components/templates/TemplateCard";
import TemplateForm from "../components/templates/TemplateForm";

const STAGES = [
  { key: "new", label: "New Lead", color: "bg-slate-100 text-slate-700" },
  { key: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-700" },
  { key: "qualified", label: "Qualified", color: "bg-violet-100 text-violet-700" },
  { key: "proposal", label: "Proposal Sent", color: "bg-amber-100 text-amber-700" },
  { key: "negotiation", label: "Negotiation", color: "bg-orange-100 text-orange-700" },
  { key: "won", label: "Won", color: "bg-emerald-100 text-emerald-700" },
  { key: "lost", label: "Lost", color: "bg-red-100 text-red-700" },
];

export default function Templates() {
  const queryClient = useQueryClient();
  const [selectedStage, setSelectedStage] = useState("all");
  const [lang, setLang] = useState("english");
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email_templates"],
    queryFn: () => base44.entities.EmailTemplate.list("-created_date"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["email_templates"] }),
  });

  const filtered = templates.filter((t) => {
    const stageMatch = selectedStage === "all" || t.stage === selectedStage;
    const langMatch = t.language === lang;
    return stageMatch && langMatch;
  });

  const emailTemplates = filtered.filter((t) => t.type === "email");
  const callScripts = filtered.filter((t) => t.type === "call_script");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-slate-900"
            >
              Email & Script Templates
            </motion.h1>
            <p className="text-slate-500 mt-1">
              Ready-to-use templates for B2B mold sourcing — English & Spanish
            </p>
          </div>
          <Button
            onClick={() => { setEditingTemplate(null); setShowForm(true); }}
            className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> New Template
          </Button>
        </div>

        {/* Language Toggle */}
        <div className="flex items-center gap-3 mb-6">
          <Languages className="w-5 h-5 text-slate-400" />
          <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
            <button
              onClick={() => setLang("english")}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                lang === "english" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              🇺🇸 English
            </button>
            <button
              onClick={() => setLang("spanish")}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                lang === "spanish" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              🇪🇸 Spanish
            </button>
          </div>
          <span className="text-xs text-slate-400 ml-2">
            {lang === "spanish"
              ? "For LATAM & Spain (.mx, .ar, .co, .es, .cl, .pe, .ve)"
              : "For all other markets"}
          </span>
        </div>

        {/* Stage Filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setSelectedStage("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedStage === "all"
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            All Stages
          </button>
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSelectedStage(s.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedStage === s.key
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {showForm && (
          <TemplateForm
            template={editingTemplate}
            onClose={() => { setShowForm(false); setEditingTemplate(null); }}
          />
        )}

        {isLoading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-white rounded-xl animate-pulse border border-slate-100" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="email">
            <TabsList className="mb-6 bg-white border border-slate-200">
              <TabsTrigger value="email" className="gap-2">
                <Mail className="w-4 h-4" /> Email Templates ({emailTemplates.length})
              </TabsTrigger>
              <TabsTrigger value="call" className="gap-2">
                <Phone className="w-4 h-4" /> Call Scripts ({callScripts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              {emailTemplates.length === 0 ? (
                <EmptyState type="email templates" lang={lang} />
              ) : (
                <div className="space-y-4">
                  {emailTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      stages={STAGES}
                      onEdit={(t) => { setEditingTemplate(t); setShowForm(true); }}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="call">
              {callScripts.length === 0 ? (
                <EmptyState type="call scripts" lang={lang} />
              ) : (
                <div className="space-y-4">
                  {callScripts.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      stages={STAGES}
                      onEdit={(t) => { setEditingTemplate(t); setShowForm(true); }}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function EmptyState({ type, lang }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="font-medium text-slate-500 text-lg">No {type} yet</p>
      <p className="text-sm mt-1">
        {lang === "spanish" ? "No hay plantillas en español aún." : "Click \"New Template\" to add one."}
      </p>
    </div>
  );
}