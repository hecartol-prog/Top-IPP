import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Pencil, Trash2, ChevronDown, ChevronUp, Send, MessageSquare, Trophy } from "lucide-react";

export default function TemplateCard({ template, stages, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const stage = stages.find((s) => s.key === template.stage);

  const handleCopy = () => {
    const text = template.subject
      ? `Subject: ${template.subject}\n\n${template.body}`
      : template.body;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const previewText = template.body?.slice(0, 180) + (template.body?.length > 180 ? "..." : "");

  return (
    <Card className="border border-slate-200 bg-white hover:shadow-sm transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-semibold text-slate-900">{template.name}</span>
              {stage && (
                <Badge className={`text-xs ${stage.color}`}>{stage.label}</Badge>
              )}
              <Badge className="text-xs bg-slate-100 text-slate-600">
                {template.language === "spanish" ? "🇪🇸 ES" : "🇺🇸 EN"}
              </Badge>
            </div>

            {template.subject && (
              <p className="text-sm text-slate-500 mb-2">
                <span className="font-medium text-slate-700">Subject:</span> {template.subject}
              </p>
            )}

            <div className="text-sm text-slate-600 leading-relaxed">
              {expanded ? (
                <pre className="whitespace-pre-wrap font-sans">{template.body}</pre>
              ) : (
                <p>{previewText}</p>
              )}
            </div>

            {template.body?.length > 180 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-teal-600 hover:text-teal-700 mt-2 flex items-center gap-1"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" /> Collapse</> : <><ChevronDown className="w-3 h-3" /> Read full template</>}
              </button>
            )}

            {/* Performance metrics */}
            {(template.times_sent > 0 || template.reply_count > 0 || template.deals_won > 0) && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Send className="w-3 h-3" /> {template.times_sent || 0} sent
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <MessageSquare className="w-3 h-3" /> {template.reply_count || 0} replies
                </span>
                {template.times_sent > 0 && (
                  <span className="text-xs text-slate-400">
                    ({Math.round(((template.reply_count || 0) / template.times_sent) * 100)}% reply rate)
                  </span>
                )}
                {template.deals_won > 0 && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <Trophy className="w-3 h-3" /> {template.deals_won} won
                  </span>
                )}
              </div>
            )}

            {/* Playbook metadata */}
            {(template.icp_type || template.buyer_role || template.pain_point) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {template.icp_type && <Badge variant="outline" className="text-[10px] text-slate-500">{template.icp_type}</Badge>}
                {template.buyer_role && <Badge variant="outline" className="text-[10px] text-slate-500">{template.buyer_role}</Badge>}
                {template.pain_point && <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-200">{template.pain_point}</Badge>}
                {template.cta_type && <Badge variant="outline" className="text-[10px] text-teal-600 border-teal-200">CTA: {template.cta_type}</Badge>}
              </div>
            )}

            {template.notes && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mt-3 border border-amber-100">
                💡 {template.notes}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="text-slate-500 hover:text-slate-700 gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(template)}
              className="text-slate-400 hover:text-slate-600"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(template.id)}
              className="text-slate-300 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}