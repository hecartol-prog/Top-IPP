import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, Users, Kanban, Building2,
  Menu, X, LogOut, ChevronDown, Linkedin, Plug, CheckSquare, FileText, MailOpen, Zap, Mail
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigation = [
  { name: "Dashboard", href: "Dashboard", icon: LayoutDashboard },
  { name: "Tasks", href: "Tasks", icon: CheckSquare },
  { name: "Leads", href: "Leads", icon: Users },
  { name: "Pipeline", href: "Pipeline", icon: Kanban },
  { name: "Companies", href: "Companies", icon: Building2 },
  { name: "Templates", href: "Templates", icon: FileText },
  { name: "Outreach", href: "Outreach", icon: MailOpen },
  { name: "Sequences", href: "Sequences", icon: Zap },
  { name: "Email Outreach", href: "EmailOutreach", icon: Mail },
  { name: "Integrations", href: "Integrations", icon: Plug },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-blue-50/40">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-blue-950/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-[#0a1f44] border-r border-blue-900 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-blue-900/50">
            <Link to={createPageUrl('Dashboard')} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-gray-200 shrink-0">
                <img src="https://media.base44.com/images/public/69735534c3f88d9fd4f7f50c/143178d5e_logoTop.jpg" alt="Top Mold Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="font-bold text-white text-lg tracking-tight">Top Mold CRM</span>
                <p className="text-[10px] text-blue-300 -mt-0.5">Lead Management</p>
              </div>
            </Link>
            <button 
              className="lg:hidden text-blue-300 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = currentPageName === item.href;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.href)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-blue-100 hover:bg-blue-800/60 hover:text-white'
                    }
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-blue-300'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Integration Status - hidden on very small screens to save space */}
          <div className="px-4 py-3 border-t border-blue-900/50 hidden sm:block">
            <div className="bg-blue-900/40 rounded-xl p-3">
              <p className="text-xs font-medium text-blue-300 uppercase tracking-wide mb-2">Integrations</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs text-blue-100">LinkedIn</span>
                  </div>
                  <span className="text-xs text-emerald-400 font-medium">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-orange-500 rounded text-white text-[8px] font-bold flex items-center justify-center shrink-0">HS</span>
                    <span className="text-xs text-blue-100">HubSpot</span>
                  </div>
                  <span className="text-xs text-emerald-400 font-medium">✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* User Profile */}
          <div className="p-4 border-t border-blue-900/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-800/50 transition-colors">
                  <Avatar className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-white truncate">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-blue-300 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-blue-300" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleLogout} className="text-rose-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-blue-100">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 flex items-center justify-end gap-4">
              <span className="text-xs sm:text-sm text-slate-500 hidden sm:block truncate max-w-xs">
                Plastic Injection Mold Manufacturing CRM
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}