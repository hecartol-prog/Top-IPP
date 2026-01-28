import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function LeadCSVImport({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setMessage(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file first' });
      return;
    }

    try {
      setUploading(true);
      setMessage(null);

      // Upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data from CSV
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            leads: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  work_phone: { type: "string" },
                  mobile_phone: { type: "string" },
                  company_name: { type: "string" },
                  title: { type: "string" },
                  linkedin: { type: "string" },
                  location: { type: "string" },
                  company_domain: { type: "string" },
                  company_teamsize: { type: "string" },
                  company_industry: { type: "string" },
                  company_location: { type: "string" },
                  note: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.status === 'error') {
        setMessage({ type: 'error', text: result.details || 'Failed to parse CSV file. Please ensure it has the required columns.' });
        setUploading(false);
        return;
      }

      const leads = result.output?.leads || [];
      
      if (leads.length === 0) {
        setMessage({ type: 'error', text: 'No valid leads found in CSV. Please check your file format.' });
        setUploading(false);
        return;
      }

      // Import leads
      let imported = 0;
      for (const lead of leads) {
        if (lead.name && lead.company_name) {
          try {
            // Parse name into first and last name
            const nameParts = (lead.name || '').trim().split(' ');
            const first_name = nameParts[0] || '';
            const last_name = nameParts.slice(1).join(' ') || nameParts[0] || 'Unknown';
            
            await base44.entities.Lead.create({
              first_name,
              last_name,
              email: lead.email || '',
              phone: lead.work_phone || lead.mobile_phone || '',
              job_title: lead.title || '',
              company_name: lead.company_name,
              company_size: lead.company_teamsize || '',
              industry: lead.company_industry || '',
              linkedin_url: lead.linkedin || '',
              website: lead.company_domain || '',
              location: lead.location || lead.company_location || '',
              notes: lead.note || '',
              status: 'new',
              source: 'csv_import'
            });
            imported++;
          } catch (error) {
            console.error('Failed to create lead:', error);
          }
        }
      }

      setMessage({ 
        type: 'success', 
        text: `Successfully imported ${imported} out of ${leads.length} leads` 
      });
      setFile(null);
      
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('CSV Import Error:', error);
      setMessage({ type: 'error', text: `Import failed: ${error.message || 'Unknown error'}` });
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import Leads from CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert className={message.type === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}>
            <AlertDescription className={message.type === 'success' ? 'text-emerald-800' : 'text-red-800'}>
              {message.type === 'success' && <CheckCircle2 className="w-4 h-4 inline mr-2" />}
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={uploading}
          />
          
          {file && (
            <div className="text-sm text-slate-600 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              {file.name}
            </div>
          )}

          <Button 
            onClick={handleImport} 
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </>
            )}
          </Button>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-600 mb-2"><strong>Required CSV Columns:</strong></p>
          <p className="text-xs text-slate-500 mb-2">
            name, company_name (or: COMPANY NAME)
          </p>
          <p className="text-xs text-slate-600 mb-2"><strong>Supported Columns:</strong></p>
          <p className="text-xs text-slate-500">
            email, work_phone, mobile_phone, title, linkedin, location, company_domain, company_teamsize, company_industry, company_location, note
          </p>
        </div>
      </CardContent>
    </Card>
  );
}