import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Loader2, CheckCircle2, List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LeadIQPanel() {
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      setLoading(true);
      const { data } = await base44.functions.invoke('leadiqGetLists');
      
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
        return;
      }
      
      const listsData = data.lists || data.data || [];
      setLists(listsData);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load LeadIQ lists' });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedList) {
      setMessage({ type: 'error', text: 'Please select a list' });
      return;
    }

    try {
      setImporting(true);
      setMessage(null);
      
      const { data } = await base44.functions.invoke('leadiqImportList', {
        list_id: selectedList
      });

      if (data.error) {
        setMessage({ type: 'error', text: data.error });
        return;
      }

      setMessage({ 
        type: 'success', 
        text: `Successfully imported ${data.imported} leads out of ${data.total} contacts` 
      });
      setSelectedList("");
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to import list' });
    } finally {
      setImporting(false);
    }
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
        {message && (
          <Alert className={message.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}>
            <AlertDescription className={message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-700">Select List to Import</label>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <Select value={selectedList} onValueChange={setSelectedList}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a LeadIQ list..." />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      <div className="flex items-center gap-2">
                        <List className="w-4 h-4" />
                        {list.name} ({list.contactCount || list.count || 0} contacts)
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                onClick={handleImport} 
                disabled={!selectedList || importing}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import Selected List
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            💡 <strong>Tip:</strong> Look for "Moldes Leads" list to import your target prospects
          </p>
        </div>
      </CardContent>
    </Card>
  );
}