import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DollarSign, Building2, AlertTriangle, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { differenceInDays, parseISO } from "date-fns";

const PIPELINE_STAGES = [
  { id: "new", label: "New Lead", color: "bg-blue-500", prob: 5, stallDays: 3 },
  { id: "contacted", label: "Contacted", color: "bg-purple-500", prob: 15, stallDays: 3 },
  { id: "qualified", label: "Qualified", color: "bg-amber-500", prob: 30, stallDays: 5 },
  { id: "proposal", label: "Proposal Sent", color: "bg-cyan-500", prob: 50, stallDays: 5 },
  { id: "negotiation", label: "Negotiation", color: "bg-orange-500", prob: 70, stallDays: 7 },
  { id: "won", label: "Won", color: "bg-emerald-500", prob: 100, stallDays: null },
  { id: "lost", label: "Lost", color: "bg-slate-400", prob: 0, stallDays: null }
];

function LeadPipelineCard({ lead, onClick, index, stageProb, stallDays }) {
  const initials = `${lead.first_name?.[0] || ''}${lead.last_name?.[0] || ''}`.toUpperCase();
  const daysSinceUpdate = lead.updated_date
    ? differenceInDays(new Date(), parseISO(lead.updated_date))
    : differenceInDays(new Date(), parseISO(lead.created_date));
  const isStalled = stallDays && daysSinceUpdate >= stallDays;
  const weightedValue = lead.estimated_value ? Math.round(lead.estimated_value * stageProb / 100) : null;

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Card 
            className={`p-3 bg-white cursor-pointer hover:shadow-md transition-all ${
              snapshot.isDragging ? 'shadow-lg ring-2 ring-teal-500' : ''
            } ${isStalled ? 'border-red-300 border' : 'border border-slate-100'}`}
            onClick={() => onClick(lead)}
          >
            <div className="flex items-start gap-2">
              <Avatar className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-800 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-800 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="font-medium text-sm text-slate-900 truncate">
                    {lead.first_name} {lead.last_name}
                  </p>
                  {isStalled && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" title="Deal stalled" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate">{lead.company_name}</span>
                </div>
                {lead.estimated_value && (
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <DollarSign className="w-3 h-3" />
                      {lead.estimated_value.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <TrendingUp className="w-3 h-3" />
                      <span>${weightedValue?.toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {isStalled && (
                  <p className="text-xs text-red-500 mt-1">Stalled {daysSinceUpdate}d</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </Draggable>
  );
}

export default function PipelineBoard({ leads, onLeadClick, onStatusChange }) {
  const getLeadsByStatus = (status) => {
    return leads.filter(lead => lead.status === status);
  };

  const getStageValue = (status) => {
    return getLeadsByStatus(status).reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    
    const lead = leads.find(l => l.id === draggableId);
    if (lead && lead.status !== newStatus) {
      onStatusChange(lead, newStatus);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
        {PIPELINE_STAGES.map(stage => (
          <div 
            key={stage.id} 
            className="flex-shrink-0 w-72"
          >
            {/* Stage Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <span className="font-semibold text-sm text-slate-700">{stage.label}</span>
                <Badge variant="secondary" className="text-xs bg-slate-100">
                  {getLeadsByStatus(stage.id).length}
                </Badge>
              </div>
              <span className="text-xs font-medium text-slate-500">
                ${getStageValue(stage.id).toLocaleString()}
              </span>
            </div>

            {/* Stage Content */}
            <Droppable droppableId={stage.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-2 p-2 rounded-xl min-h-[500px] transition-colors ${
                    snapshot.isDraggingOver 
                      ? 'bg-teal-50 ring-2 ring-teal-200' 
                      : 'bg-slate-50'
                  }`}
                >
                  <AnimatePresence>
                    {getLeadsByStatus(stage.id).map((lead, index) => (
                      <LeadPipelineCard
                        key={lead.id}
                        lead={lead}
                        index={index}
                        onClick={onLeadClick}
                      />
                    ))}
                  </AnimatePresence>
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}