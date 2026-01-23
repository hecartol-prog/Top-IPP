import React from "react";
import { motion } from "framer-motion";
import { Linkedin, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LinkedInPanel from "../components/integrations/LinkedInPanel";

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
            <Card className="border-0 shadow-sm">
              <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">LQ</span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">LeadIQ</CardTitle>
                      <p className="text-sm text-slate-500 mt-0.5">Prospect Search & Enrichment</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-900 text-sm mb-2">How to Use LeadIQ</h4>
                  <ol className="text-sm text-slate-600 space-y-2">
                    <li className="flex gap-2">
                      <span className="font-semibold text-purple-600">1.</span>
                      <span>Go to the Leads page</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-purple-600">2.</span>
                      <span>Click "Search LeadIQ" button</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-purple-600">3.</span>
                      <span>Enter search criteria (company, job titles, industry)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-purple-600">4.</span>
                      <span>Select prospects and add them to your CRM</span>
                    </li>
                  </ol>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <h4 className="text-sm font-semibold text-purple-900 mb-2">✨ Features Available</h4>
                  <ul className="text-xs text-purple-700 space-y-1">
                    <li>• Search prospects by company and job title</li>
                    <li>• Filter by location, industry, and company size</li>
                    <li>• Get verified email addresses and phone numbers</li>
                    <li>• LinkedIn profile URLs included</li>
                    <li>• Bulk import selected prospects</li>
                  </ul>
                </div>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    <strong>Note:</strong> LeadIQ API usage is subject to your plan limits. Make sure you have active credits.
                  </p>
                </div>
              </CardContent>
            </Card>
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