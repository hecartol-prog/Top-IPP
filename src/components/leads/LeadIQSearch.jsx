import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Search, Plus, Building2, MapPin, Mail, Phone, Linkedin, Loader2, CheckCircle } from "lucide-react";

export default function LeadIQSearch({ open, onClose, onLeadsAdded }) {
  const [searchParams, setSearchParams] = useState({
    company_name: "",
    job_titles: "",
    location: "",
    industry: "",
    company_size: ""
  });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProspects, setSelectedProspects] = useState(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const handleSearch = async () => {
    setIsSearching(true);
    setSearchResults([]);
    setSelectedProspects(new Set());

    try {
      const job_titles = searchParams.job_titles
        ? searchParams.job_titles.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      const response = await base44.functions.invoke('leadiqSearchProspects', {
        company_name: searchParams.company_name || undefined,
        job_titles: job_titles.length > 0 ? job_titles : undefined,
        location: searchParams.location || undefined,
        industry: searchParams.industry || undefined,
        company_size: searchParams.company_size || undefined,
        limit: 20
      });

      if (response.data.success) {
        setSearchResults(response.data.prospects || []);
      } else {
        alert('Search failed: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Search error: ' + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleProspect = (index) => {
    const newSelected = new Set(selectedProspects);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedProspects(newSelected);
  };

  const handleAddSelected = async () => {
    if (selectedProspects.size === 0) return;

    setIsAdding(true);
    try {
      const prospectsToAdd = Array.from(selectedProspects).map(index => searchResults[index]);
      
      // Bulk create leads
      await base44.entities.Lead.bulkCreate(prospectsToAdd);

      // Notify parent and close
      if (onLeadsAdded) {
        onLeadsAdded(prospectsToAdd.length);
      }

      // Reset and close
      setSearchResults([]);
      setSelectedProspects(new Set());
      setSearchParams({
        company_name: "",
        job_titles: "",
        location: "",
        industry: "",
        company_size: ""
      });
      onClose();
    } catch (error) {
      alert('Error adding leads: ' + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded text-white flex items-center justify-center text-xs font-bold">
              LQ
            </div>
            Search LeadIQ Prospects
          </DialogTitle>
        </DialogHeader>

        {/* Search Form */}
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={searchParams.company_name}
                onChange={(e) => setSearchParams(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="e.g., Tesla, Apple"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={searchParams.industry}
                onChange={(e) => setSearchParams(prev => ({ ...prev, industry: e.target.value }))}
                placeholder="e.g., Automotive, Technology"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job_titles">Job Titles (comma-separated)</Label>
            <Input
              id="job_titles"
              value={searchParams.job_titles}
              onChange={(e) => setSearchParams(prev => ({ ...prev, job_titles: e.target.value }))}
              placeholder="e.g., VP Manufacturing, Engineering Manager, Procurement Director"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={searchParams.location}
                onChange={(e) => setSearchParams(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Chicago, IL"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_size">Company Size</Label>
              <Select 
                value={searchParams.company_size} 
                onValueChange={(v) => setSearchParams(prev => ({ ...prev, company_size: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Any size</SelectItem>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="501-1000">501-1000 employees</SelectItem>
                  <SelectItem value="1000+">1000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleSearch} 
            disabled={isSearching || (!searchParams.company_name && !searchParams.industry)}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching LeadIQ...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search Prospects
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {searchResults.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                Found {searchResults.length} prospects • {selectedProspects.size} selected
              </p>
              <Button
                onClick={handleAddSelected}
                disabled={selectedProspects.size === 0 || isAdding}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Selected ({selectedProspects.size})
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {searchResults.map((prospect, index) => {
                const isSelected = selectedProspects.has(index);
                const initials = `${prospect.first_name?.[0] || ''}${prospect.last_name?.[0] || ''}`.toUpperCase();

                return (
                  <Card
                    key={index}
                    className={`p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => toggleProspect(index)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="relative">
                        <Avatar className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-800">
                          <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-800 text-white font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-slate-900">
                              {prospect.first_name} {prospect.last_name}
                            </h4>
                            <p className="text-sm text-slate-500">{prospect.job_title}</p>
                          </div>
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                            LeadIQ
                          </Badge>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {prospect.company_name && (
                            <div className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              <span>{prospect.company_name}</span>
                            </div>
                          )}
                          {prospect.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{prospect.location}</span>
                            </div>
                          )}
                          {prospect.email && (
                            <div className="flex items-center gap-1 text-emerald-600">
                              <Mail className="w-3 h-3" />
                              <span>{prospect.email}</span>
                            </div>
                          )}
                          {prospect.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span>{prospect.phone}</span>
                            </div>
                          )}
                          {prospect.linkedin_url && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Linkedin className="w-3 h-3" />
                              <span>LinkedIn</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!isSearching && searchResults.length === 0 && searchParams.company_name && (
          <div className="text-center py-8 text-slate-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No prospects found. Try adjusting your search criteria.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}