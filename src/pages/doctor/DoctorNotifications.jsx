import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle2, Clock, FlaskConical, Stethoscope, AlertTriangle, Trash2, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { notificationService } from '@/services/notification.service';
import { useAuth } from '@/lib/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export default function DoctorNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = () => {
    const live = notificationService.getNotificationsForRole('doctor');
    setNotifications(live);
  };

  useEffect(() => {
    loadNotifications();
    const unsubscribe = notificationService.subscribe(() => {
      loadNotifications();
    });
    return unsubscribe;
  }, []);

  const markAllRead = () => {
    notificationService.markAllAsRead(user?.id || 'doctor');
    loadNotifications();
    toast.success('All notifications marked as read');
  };

  const clearAll = () => {
    notificationService.clearAll();
    setNotifications([]);
    toast.info('Notifications cleared');
  };

  const handleMarkOne = (id) => {
    notificationService.markAsRead(id, user?.id || 'doctor');
    loadNotifications();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-primary" />
            Clinical Alerts & Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time diagnostic alerts, nurse administration updates, and incoming patient queue status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <Check className="w-4 h-4 mr-1.5" /> Mark All Read
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-1.5" /> Clear
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="p-10 text-center text-muted-foreground space-y-2">
              <Bell className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No new notifications</p>
              <p className="text-xs">You are all caught up! New patient queue arrivals, paid registration alerts, and lab results will appear here in real time.</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map(n => {
            const isRead = n.read || (n.readBy && (n.readBy.includes(user?.id) || n.readBy.includes('doctor')));
            let timeStr = 'Just now';
            if (n.createdAt) {
              try {
                timeStr = formatDistanceToNow(new Date(n.createdAt), { addSuffix: true });
              } catch {
                timeStr = n.createdAt;
              }
            } else if (n.time) {
              timeStr = n.time;
            }

            return (
              <Card
                key={n.id}
                className={`border transition-all ${
                  isRead
                    ? 'border-border/60 bg-card/60 opacity-80'
                    : 'border-primary/30 bg-primary/5 shadow-xs'
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      n.type === 'error' || n.type === 'alert'
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                        : n.module === 'lab'
                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                        : n.module === 'nurse'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-primary/15 text-primary'
                    }`}
                  >
                    {n.type === 'error' || n.type === 'alert' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : n.module === 'lab' ? (
                      <FlaskConical className="w-4 h-4" />
                    ) : (
                      <Stethoscope className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate">{n.title}</h4>
                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {timeStr}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                      {n.link ? (
                        <Link to={n.link} className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1">
                          View details <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : <span />}
                      {!isRead && (
                        <Button variant="ghost" size="xs" onClick={() => handleMarkOne(n.id)} className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground">
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
