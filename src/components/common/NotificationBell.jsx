import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  ExternalLink, 
  Clock, 
  FlaskConical, 
  Pill, 
  CreditCard, 
  Users, 
  Stethoscope, 
  Sparkles
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { notificationService } from '@/services/notification.service';
import { supabase } from '@/lib/supabase';

const MODULE_ICONS = {
  patient: Users,
  queue: Stethoscope,
  lab: FlaskConical,
  pharmacy: Pill,
  nurse: Stethoscope,
  billing: CreditCard,
  owner: Sparkles,
};

const MODULE_COLORS = {
  patient: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  queue: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
  lab: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  pharmacy: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  nurse: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  billing: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  owner: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
};

function formatTimeAgo(dateStr) {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}

export default function NotificationBell({ role = 'default' }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedModule, setSelectedModule] = useState('all');
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe(() => {
      setNotifications(notificationService.getNotifications(role));
    });
    setNotifications(notificationService.getNotifications(role));
    return () => unsubscribe();
  }, [role]);

  useEffect(() => {
    let isMounted = true;

    async function syncHospitalEvents() {
      try {
        if (!supabase) return;

        // 1. Doctor & Reception & Owner: check waiting visits
        if (['doctor', 'receptionist', 'owner', 'admin'].includes(role)) {
          const { count } = await supabase
            .from('visits')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'waiting');

          if (isMounted && count && count > 0) {
            notificationService.dispatch({
              title: 'Active Patient Queue',
              message: `${count} patient${count > 1 ? 's are' : ' is'} waiting in the consultation queue.`,
              type: 'info',
              module: 'queue',
              targetRoles: ['doctor', 'receptionist', 'owner'],
              link: role === 'doctor' ? '/doctor/queue' : '/reception/queue'
            });
          }
        }

        // 2. Lab & Owner: check pending lab orders
        if (['lab_technician', 'owner', 'admin'].includes(role)) {
          const { count } = await supabase
            .from('lab_orders')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

          if (isMounted && count && count > 0) {
            notificationService.dispatch({
              title: 'Pending Lab Orders',
              message: `${count} laboratory test order${count > 1 ? 's require' : ' requires'} attention.`,
              type: 'warning',
              module: 'lab',
              targetRoles: ['lab_technician', 'owner'],
              link: '/lab/requests'
            });
          }
        }

        // 3. Pharmacy & Owner: check low stock
        if (['pharmacist', 'owner', 'admin'].includes(role)) {
          const { data: lowStock } = await supabase
            .from('medicines')
            .select('name, quantity, min_stock')
            .lte('quantity', 10)
            .limit(3);

          if (isMounted && lowStock && lowStock.length > 0) {
            const medNames = lowStock.map(m => m.name).join(', ');
            notificationService.dispatch({
              title: 'Low Medicine Stock',
              message: `Critically low inventory on: ${medNames}.`,
              type: 'alert',
              module: 'pharmacy',
              targetRoles: ['pharmacist', 'owner'],
              link: '/pharmacy/inventory'
            });
          }
        }

        // 4. Billing & Owner: check pending payments
        if (['accountant', 'owner', 'admin'].includes(role)) {
          const { count } = await supabase
            .from('payments')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

          if (isMounted && count && count > 0) {
            notificationService.dispatch({
              title: 'Pending Invoices',
              message: `${count} pending payment invoice${count > 1 ? 's awaiting' : ' awaits'} collection.`,
              type: 'info',
              module: 'billing',
              targetRoles: ['accountant', 'owner'],
              link: '/billing/payments'
            });
          }
        }
      } catch {
        // silent
      }
    }

    syncHospitalEvents();
    const interval = setInterval(syncHospitalEvents, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [role]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.readBy?.includes(role)).length;
  }, [notifications, role]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const isUnread = !n.readBy?.includes(role);
      if (filter === 'unread' && !isUnread) return false;
      if (selectedModule !== 'all' && n.module !== selectedModule) return false;
      return true;
    });
  }, [notifications, role, filter, selectedModule]);

  const handleMarkAllRead = () => {
    notificationService.markAllAsRead(role);
  };

  const handleClearAll = () => {
    notificationService.clearAll(role);
  };

  const handleItemClick = (item) => {
    notificationService.markAsRead(item.id, role);
    if (item.link) {
      setIsOpen(false);
      navigate(item.link);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-foreground/80 hover:text-foreground transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 shadow-xl border-border/60 bg-card backdrop-blur-md rounded-xl z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold tracking-tight text-foreground">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[11px] h-5 px-1.5 font-medium bg-primary/10 text-primary">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                onClick={handleMarkAllRead}
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Read all
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={handleClearAll}
                title="Clear notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/40 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === 'unread'
                  ? 'bg-background text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="text-[11px] bg-background border border-border/60 rounded px-1.5 py-0.5 text-muted-foreground focus:outline-none"
          >
            <option value="all">All Modules</option>
            <option value="queue">Queue</option>
            <option value="patient">Patient</option>
            <option value="lab">Lab</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="billing">Billing</option>
          </select>
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-[350px] overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-2 text-muted-foreground">
                <Bell className="w-5 h-5 opacity-40" />
              </div>
              <p className="text-xs font-medium text-foreground">No notifications</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {filter === 'unread' ? 'All caught up! No unread alerts.' : 'No active alerts in this category.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredNotifications.map((notif) => {
                const IconComponent = MODULE_ICONS[notif.module] || Bell;
                const iconColorClass = MODULE_COLORS[notif.module] || 'bg-muted text-foreground';
                const isUnread = !notif.readBy?.includes(role);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3 flex items-start gap-3 transition-colors cursor-pointer relative group ${
                      isUnread
                        ? 'bg-primary/5 hover:bg-primary/10'
                        : 'hover:bg-muted/50 opacity-80'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColorClass}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${isUnread ? 'text-foreground font-bold' : 'text-foreground/90'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                      {notif.link && (
                        <div className="mt-1.5 flex items-center text-[10px] font-medium text-primary hover:underline">
                          <span>View in portal</span>
                          <ExternalLink className="w-2.5 h-2.5 ml-1" />
                        </div>
                      )}
                    </div>

                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
