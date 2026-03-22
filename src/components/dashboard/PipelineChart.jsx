import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

const stageColors = {
  new: "#93c5fd",
  contacted: "#60a5fa",
  qualified: "#3b82f6",
  proposal: "#2563eb",
  negotiation: "#1d4ed8",
  won: "#1e3a8a",
  lost: "#94a3b8"
};

const stageLabels = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost"
};

export default function PipelineChart({ leads }) {
  const stageData = Object.keys(stageLabels).map(stage => ({
    name: stageLabels[stage],
    value: leads.filter(l => l.status === stage).reduce((sum, l) => sum + (l.estimated_value || 0), 0),
    count: leads.filter(l => l.status === stage).length,
    stage
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100">
          <p className="font-semibold text-slate-900">{data.name}</p>
          <p className="text-sm text-slate-600">{data.count} leads</p>
          <p className="text-sm font-medium text-emerald-600">${data.value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">Pipeline Value by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64" style={{ minHeight: 256 }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={256}>
              <BarChart data={stageData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={stageColors[entry.stage]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}