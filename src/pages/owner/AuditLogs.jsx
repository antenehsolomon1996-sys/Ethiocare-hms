import { useQuery } from '@tanstack/react-query';
import { ethioCareClient } from '@/api/ethioCareClient';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Shield, Search, User, Clock, Activity, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

const ACTION_COLORS = {
  login: 'bg-green-100 text-green-700',
  logout: 'bg-gray-100 text-gray-600',
  create: 'bg-blue-100 text-blue-700',
  update: 'bg-amber-100 text-amber-700',
  delete: 'bg-red-100 text-red-700',
  view: 'bg-purple-100 text-purple-700',
  print: 'bg-teal-100 text-teal-700',
  approve: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-orange-100 text-orange-700',
};

const ROLE_COLORS = {
  owner: 'bg-yellow-100 text-yellow-700',
  doctor: 'bg-blue-100 text-blue-700',
  nurse: 'bg-pink-100 text-pink-700',
  pharmacist: 'bg-green-100 text-green-700',
  receptionist: 'bg-purple-100 text-purple-700',
  lab_technician: 'bg-cyan-100 text-cyan-700',
};

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [detailLog, setDetailLog] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => ethioCareClient.entities.AuditLog.list('-created_date', 500)
  });

  const modules = [...new Set(logs.map(l => l.module).filter(Boolean))];

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.description?.toLowerCase().includes(search.toLowerCase()) ||
      l.record_name?.toLowerCase().includes(search.toLowerCase());
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    const matchModule = moduleFilter === 'all' || l.module === moduleFilter;
    return matchSearch && matchAction && matchModule;
  });

  const todayCount = logs.filter(l => {
    const d = new Date(l.created_date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground">{logs.length} total entries · {todayCount} today</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['create', 'update', 'delete', 'login'].map(action => {
          const count = logs.filter(l => l.action === action).length;
          return (
            <div key={action} className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold">{count}</p>
              <Badge className={`${ACTION_COLORS[action]} text-xs mt-1`}>{action}</Badge>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by user, action, or record..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {['login', 'logout', 'create', 'update', 'delete', 'view', 'print', 'approve', 'reject'].map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Module" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Log Table - Desktop */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No audit entries found</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Timestamp &amp; IP</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">User &amp; Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Action &amp; Module</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map(log => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      {/* 1. Timestamp & IP */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 text-xs text-foreground font-medium">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm:ss') : '-'}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">
                          IP: {log.ip_address || 'Internal/Local'}
                        </span>
                      </td>

                      {/* 2. User & Role */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-3 h-3 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{log.user_name}</p>
                            <Badge className={`text-[9px] px-1 py-0 ${ROLE_COLORS[log.user_role] || 'bg-gray-100 text-gray-600'}`}>
                              {log.user_role?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                      </td>

                      {/* 3. Action & Module */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                            {log.action}
                          </Badge>
                          <span className="text-xs font-medium text-muted-foreground capitalize">
                            {log.module}
                          </span>
                        </div>
                      </td>

                      {/* 4. Description & Details */}
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground truncate max-w-[160px] text-left">
                            {log.description}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => setDetailLog(log)}
                            title="View log details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card list */}
            <div className="md:hidden space-y-2 p-3">
              {filtered.slice(0, 200).map(log => (
                <div key={log.id} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : '-'}
                    </div>
                    <Badge className={`text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{log.user_name}</span>
                    <Badge className={`text-xs ${ROLE_COLORS[log.user_role] || 'bg-gray-100 text-gray-600'}`}>
                      {log.user_role?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{log.description}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Audit Log Details Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              Audit Log Event Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete forensic record and action payload.
            </DialogDescription>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-muted/40 p-3.5 rounded-xl space-y-2.5 border border-border/60">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Timestamp:</span>
                  <span className="font-mono">{detailLog.created_date ? format(new Date(detailLog.created_date), 'yyyy-MM-dd HH:mm:ss') : '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">User:</span>
                  <span className="font-semibold">{detailLog.user_name} ({detailLog.user_role})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">User ID:</span>
                  <span className="font-mono text-[11px]">{detailLog.user_id || 'System'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Action:</span>
                  <Badge className={`text-[10px] uppercase font-bold ${ACTION_COLORS[detailLog.action] || ''}`}>
                    {detailLog.action}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Module / Entity:</span>
                  <span className="font-semibold capitalize">{detailLog.module} · {detailLog.entity_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Record ID:</span>
                  <span className="font-mono text-[11px]">{detailLog.record_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">IP Address:</span>
                  <span className="font-mono">{detailLog.ip_address || 'Local/Internal'}</span>
                </div>
              </div>
              <div className="p-3 bg-muted/20 rounded-xl border border-border/40">
                <p className="text-muted-foreground font-medium mb-1">Description:</p>
                <p className="text-foreground leading-relaxed">{detailLog.description}</p>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setDetailLog(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}