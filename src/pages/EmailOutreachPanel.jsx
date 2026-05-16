import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, Send, RefreshCw, CheckCircle2, XCircle, Clock, 
  Inbox, BarChart3, Plus, Wifi, AlertCircle, Play
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const INBOXES = [
  { key: "sales", label: "sales@dg-topindustrial.com" },
  { key: "topmolds", label: "topmolds@dg-topindustrial.com" },
  { key: "info", label: "info@dg-topindustrial.com" },
];

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-800",
};

const STATUS_ICONS = {
  pending: <Clock className="w-3 h-3" />,
  sent: <CheckCircle2 className="w-3 h-3" />,
  failed: <XCircle className="w-3 h-3" />,
  skipped: <AlertCircle className="w-3 h-3" />,
};

export default function EmailOutreachPanel() {
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [testingInbox, setTestingInbox] = useState(null);
  const [testEmailTarget, setTestEmailTarget] = useState("");
  const [processing, setProcessing] = useState(false);

  const [newEmail, setNewEmail] = useState({
    to_email: "", to_name: "", subject: "", body: "", inbox: "sales", campaign_name: ""
  });
  const [addingEmail, setAddingEmail] = useState(false);

  const invoke = useCallback(async (action, extra = {}) => {
    const res = await base44.functions.invoke("smtpSendEmail", { action, ...extra });
    return res.data;
  }, []);

  const loadData = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [statsRes, queueRes] = await Promise.all([
        invoke("inboxStats"),
        invoke("queueStatus")
      ]);
      if (statsRes?.inboxes) setStats(statsRes);
      if (queueRes?.queue) setQueue(queueRes.queue);
    } catch (e) {
      toast.error("Failed to load data: " + e.message);
    }
    setLoadingStats(false);
  }, [invoke]);

  useEffect(() => { loadData(); }, [loadData]);

  const testConnection = async (inbox) => {
    setTestingInbox(inbox);
    try {
      const res = await invoke("test", { inbox });
      if (res?.success) toast.success(res.message);
      else toast.error(res?.error || "Connection failed");
    } catch (e) {
      toast.error(e.message);
    }
    setTestingInbox(null);
  };

  const sendTestEmail = async (inbox) => {
    if (!testEmailTarget) { toast.error("Enter a test recipient email"); return; }
    setTestingInbox("send_" + inbox);
    try {
      const res = await invoke("sendTest", { inbox, to: testEmailTarget });
      if (res?.success) toast.success(res.message);
      else toast.error(res?.error || "Send failed");
    } catch (e) {
      toast.error(e.message);
    }
    setTestingInbox(null);
  };

  const addToQueue = async () => {
    if (!newEmail.to_email || !newEmail.subject || !newEmail.body) {
      toast.error("Recipient email, subject and body are required");
      return;
    }
    setAddingEmail(true);
    try {
      const res = await invoke("addToQueue", { emails: [newEmail] });
      if (res?.success) {
        toast.success("Email added to queue");
        setNewEmail({ to_email: "", to_name: "", subject: "", body: "", inbox: "sales", campaign_name: "" });
        loadData();
      } else {
        toast.error(res?.error || "Failed to add");
      }
    } catch (e) {
      toast.error(e.message);
    }
    setAddingEmail(false);
  };

  const processNext = async () => {
    setProcessing(true);
    try {
      const res = await invoke("processQueue");
      if (res?.processed) {
        toast.success(`Sent to ${res.to} via ${res.inbox}`);
        loadData();
      } else {
        toast.info(res?.reason || res?.error || "Nothing processed");
      }
    } catch (e) {
      toast.error(e.message);
    }
    setProcessing(false);
  };

  const pendingCount = queue.filter(e => e.status === "pending").length;
  const sentCount = queue.filter(e => e.status === "sent").length;
  const failedCount = queue.filter(e => e.status === "failed").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Outreach</h1>
          <p className="text-sm text-slate-500 mt-1">Google Workspace SMTP queue — safe, human-paced sending</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loadingStats}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingStats ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard icon={<Clock className="w-5 h-5 text-yellow-500" />} label="Pending" value={pendingCount} color="yellow" />
        <SummaryCard icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} label="Sent Today" value={stats ? Object.values(stats.inboxes).reduce((s, i) => s + i.sent_today, 0) : "—"} color="green" />
        <SummaryCard icon={<XCircle className="w-5 h-5 text-red-500" />} label="Failed" value={failedCount} color="red" />
        <SummaryCard icon={<Inbox className="w-5 h-5 text-blue-500" />} label="Total in Queue" value={queue.length} color="blue" />
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="add">Add Email</TabsTrigger>
          <TabsTrigger value="inboxes">Inbox Status</TabsTrigger>
        </TabsList>

        {/* QUEUE TAB */}
        <TabsContent value="queue" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{pendingCount} email(s) waiting · Queue processes automatically every 2 minutes</p>
            <Button size="sm" onClick={processNext} disabled={processing || pendingCount === 0}>
              <Play className={`w-4 h-4 mr-2 ${processing ? "animate-pulse" : ""}`} />
              {processing ? "Sending..." : "Send Next Now"}
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Recipient</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Subject</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Inbox</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-slate-400">Queue is empty</td></tr>
                )}
                {queue.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.to_name || item.to_email}</p>
                      {item.to_name && <p className="text-xs text-slate-400">{item.to_email}</p>}
                      {item.campaign_name && <p className="text-xs text-blue-500">{item.campaign_name}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600 max-w-xs truncate">{item.subject}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{item.inbox || "auto"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[item.status]}`}>
                        {STATUS_ICONS[item.status]}
                        {item.status}
                      </span>
                      {item.error_message && <p className="text-xs text-red-500 mt-1 max-w-xs truncate">{item.error_message}</p>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">
                      {item.sent_at ? format(new Date(item.sent_at), "MMM d, HH:mm") : format(new Date(item.created_date), "MMM d, HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ADD EMAIL TAB */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Email to Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Recipient Email *</label>
                  <Input placeholder="contact@company.com" value={newEmail.to_email}
                    onChange={e => setNewEmail(p => ({ ...p, to_email: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">First Name</label>
                  <Input placeholder="John" value={newEmail.to_name}
                    onChange={e => setNewEmail(p => ({ ...p, to_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Subject *</label>
                  <Input placeholder="Plastic injection mold sourcing" value={newEmail.subject}
                    onChange={e => setNewEmail(p => ({ ...p, subject: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Send From Inbox</label>
                  <Select value={newEmail.inbox} onValueChange={v => setNewEmail(p => ({ ...p, inbox: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INBOXES.map(i => <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Campaign Name (optional)</label>
                  <Input placeholder="Q2 Injection Mold Outreach" value={newEmail.campaign_name}
                    onChange={e => setNewEmail(p => ({ ...p, campaign_name: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Email Body * (HTML or plain text)</label>
                <Textarea rows={8} placeholder="Hi {{first_name}}, ..." value={newEmail.body}
                  onChange={e => setNewEmail(p => ({ ...p, body: e.target.value }))} />
              </div>
              <Button onClick={addToQueue} disabled={addingEmail} className="w-full sm:w-auto">
                <Send className="w-4 h-4 mr-2" />
                {addingEmail ? "Adding..." : "Add to Queue"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INBOX STATUS TAB */}
        <TabsContent value="inboxes" className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Test recipient email</label>
            <div className="flex gap-2 max-w-sm">
              <Input placeholder="your@email.com" value={testEmailTarget}
                onChange={e => setTestEmailTarget(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {INBOXES.map(inbox => {
              const s = stats?.inboxes?.[inbox.key];
              const dailyLimit = 20;
              const pct = s ? Math.round((s.sent_today / dailyLimit) * 100) : 0;
              return (
                <Card key={inbox.key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-500" />
                      <span className="truncate">{inbox.label}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="text-xl font-bold text-green-700">{s?.sent_today ?? "—"}</p>
                        <p className="text-xs text-green-600">Sent today</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xl font-bold text-slate-700">{s?.remaining ?? dailyLimit}</p>
                        <p className="text-xs text-slate-500">Remaining</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Daily limit</span><span>{s?.sent_today ?? 0}/{dailyLimit}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${pct > 80 ? "bg-red-400" : pct > 50 ? "bg-yellow-400" : "bg-green-400"}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" className="w-full"
                        onClick={() => testConnection(inbox.key)}
                        disabled={testingInbox === inbox.key}>
                        <Wifi className="w-3 h-3 mr-2" />
                        {testingInbox === inbox.key ? "Verifying..." : "Test Connection"}
                      </Button>
                      <Button variant="outline" size="sm" className="w-full"
                        onClick={() => sendTestEmail(inbox.key)}
                        disabled={testingInbox === "send_" + inbox.key}>
                        <Send className="w-3 h-3 mr-2" />
                        {testingInbox === "send_" + inbox.key ? "Sending..." : "Send Test Email"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <strong>Queue automation:</strong> The queue processor runs automatically every 2 minutes with a 60–180s human-like delay. Max 20 emails/day per inbox. Inboxes rotate automatically.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }) {
  const colors = {
    yellow: "border-yellow-200 bg-yellow-50",
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    blue: "border-blue-200 bg-blue-50",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-slate-500">{label}</span></div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}