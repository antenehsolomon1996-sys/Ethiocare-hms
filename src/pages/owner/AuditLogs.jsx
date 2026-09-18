import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Search, User, Clock, Activity } from 'lucide-react';
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
  receptionist: 'bg-teal-100 text-teal-700',
  lab_technician: 'bg-purple-100 text-purple-700',
  pharmacist: 'bg-green-100 text-green-700',
  accountant: 'bg-orange-100 text-orange-700',
};

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500)
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
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Module</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map(log => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-xs font-medium">{log.user_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-xs ${ROLE_COLORS[log.user_role] || 'bg-gray-100 text-gray-600'}`}>
                          {log.user_role?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge className={`text-xs ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium">{log.module}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">{log.description}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.ip_address || '-'}</td>
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
    </div>
  );
}