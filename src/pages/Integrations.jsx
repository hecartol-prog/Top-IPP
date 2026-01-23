import React from "react";
import { motion } from "framer-motion";
import { Linkedin, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LinkedInPanel from "../components/integrations/LinkedInPanel";
import LeadIQPanel from "../components/integrations/LeadIQPanel";

export default function Integrations() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-slate-900 tracking-tight"
          >
            Integrations
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 mt-1"
          >
            Connected services to power your sales prospecting
          </motion.p>
        </div>

        {/* Integration Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LinkedIn Integration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <LinkedInPanel />
          </motion.div>

          {/* LeadIQ Integration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <LeadIQPanel />
          </motion.div>
        </div>

        {/* Usage Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-800 to-slate-900 text-white">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">🚀 Best Practices for Prospecting</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2 text-slate-200">LinkedIn Strategy</h4>
                  <ul className="text-sm text-slate-300 space-y-1">
                    <li>• Post regularly about industry insights</li>
                    <li>• Share case studies and success stories</li>
                    <li>• Engage with prospects' content first</li>
                    <li>• Use hashtags like #PlasticInjectionMolding</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-slate-200">LeadIQ Strategy</h4>
                  <ul className="text-sm text-slate-300 space-y-1">
                    <li>• Target specific job titles (VP Manufacturing, etc.)</li>
                    <li>• Focus on industries needing plastic parts</li>
                    <li>• Verify contact info before outreach</li>
                    <li>• Track all prospects in your CRM</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}