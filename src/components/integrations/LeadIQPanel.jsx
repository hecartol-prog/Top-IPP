import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Search, ExternalLink } from "lucide-react";

export default function LeadIQPanel() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setMessage({ type: 'error', text: 'Please enter a company name or domain' });
      return;
    }

    setMessage({ 
      type: 'info', 
      text: 'LeadIQ search functionality coming soon. Use the LeadIQ Chrome extension to save leads, then sync them here.' 
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">LQ</span>
          </div>
          <div>
            <CardTitle>LeadIQ</CardTitle>
            <CardDescription>Import leads from your LeadIQ lists</CardDescription>
          </div>
          <Badge className="ml-auto bg-emerald-100 text-emerald-700">Connected</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800 text-sm">
            ℹ️ LeadIQ's Public API doesn't support accessing saved lists. Use LeadIQ's Chrome extension to find and save leads, then they'll appear in your LeadIQ dashboard.
          </AlertDescription>
        </Alert>

        {message && (
          <Alert className={message.type === 'success' ? 'bg-emerald-50 border-emerald-200' : message.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}>
            <AlertDescription className={message.type === 'success' ? 'text-emerald-800' : message.type === 'error' ? 'text-red-800' : 'text-slate-700'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">Real-Time Contact Search</label>
          <div className="flex gap-2">
            <Input 
              placeholder="Search by company name or domain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button 
              onClick={handleSearch}
              disabled={searching}
              variant="outline"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <p className="text-sm font-medium text-slate-700">How to use LeadIQ:</p>
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
            <li>Install the <a href="https://chrome.google.com/webstore/detail/leadiq/bhmokemcncgjedekoccogblcedpplljp" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline inline-flex items-center gap-1">LeadIQ Chrome Extension <ExternalLink className="w-3 h-3" /></a></li>
            <li>Search for prospects on LinkedIn</li>
            <li>Use the extension to capture contact details</li>
            <li>Saved contacts appear in your LeadIQ dashboard</li>
            <li>Export from LeadIQ dashboard to CSV, then import here</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}