'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

type Notification = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close panel on click outside or navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000); // 30s
    return () => clearInterval(interval);
  }, []);

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
      });
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      toast.error('Erro ao marcar como lidas');
    }
  };

  const markAsRead = async (id: string, read_at: string | null) => {
    if (read_at) return; // already read
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      //
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        title="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive border border-background"></span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border shadow-lg rounded-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="font-semibold text-sm">Notificações</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Marcar todas como lidas
              </button>
            )}
          </div>
          
          <div className="max-h-[350px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center p-6 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                Sem novas notificações.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => markAsRead(notif.id, notif.read_at)}
                    className={cn(
                      "p-4 hover:bg-secondary/50 cursor-pointer transition-colors",
                      !notif.read_at && "bg-primary/5"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "w-2 h-2 mt-1.5 rounded-full flex-shrink-0",
                        !notif.read_at ? "bg-primary" : "bg-transparent"
                      )} />
                      <div>
                        <p className={cn("text-sm font-medium", !notif.read_at ? "text-foreground" : "text-muted-foreground")}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-2">
                          {new Date(notif.created_at).toLocaleString('pt-PT')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
