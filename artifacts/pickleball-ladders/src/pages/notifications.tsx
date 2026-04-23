import { Link } from "wouter";
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProtectedRoute } from "@/components/layout/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Notifications() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}

function NotificationsContent() {
  const { data } = useListNotifications({});
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const { toast } = useToast();
  const qc = useQueryClient();

  const notifications = (data as any)?.notifications ?? [];
  const unreadCount = (data as any)?.unreadCount ?? 0;

  const handleMarkRead = (id: string) => {
    markRead.mutate({ id }, { onSuccess: () => qc.invalidateQueries() });
  };

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => { toast({ title: "All notifications marked as read" }); qc.invalidateQueries(); },
    });
  };

  const notifIcon: Record<string, string> = {
    invitation_received: "📩",
    invitation_accepted: "🎉",
    invitation_declined: "❌",
    challenge_received: "⚔️",
    challenge_accepted: "✅",
    challenge_declined: "❌",
    challenge_expired: "⏰",
    availability_submitted: "📅",
    common_availability: "🟢",
    no_common_availability: "🔴",
    match_scheduled: "🗓️",
    score_submitted: "📋",
    score_confirmed: "✅",
    score_auto_confirmed: "🤖",
    dispute_resolved: "⚖️",
    inactivity_drop: "📉",
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <h1 className="text-2xl font-black flex items-center gap-2 min-w-0">
            <Bell className="w-6 h-6 text-primary flex-shrink-0" />
            <span>Notifications</span>
            {unreadCount > 0 && <Badge className="ml-1 flex-shrink-0">{unreadCount} new</Badge>}
          </h1>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAll} className="flex-shrink-0">
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="border-primary/10">
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-medium">No notifications yet</p>
              <p className="text-sm text-muted-foreground">You'll see updates about challenges, matches, and rankings here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif: any) => (
              <div
                key={notif.id}
                className={`p-4 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${!notif.isRead ? "bg-primary/5 border-primary/20" : "bg-card border-border"}`}
                onClick={() => !notif.isRead && handleMarkRead(notif.id)}
              >
                <span className="text-xl">{notifIcon[notif.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.isRead ? "font-semibold" : ""}`}>{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>
                {notif.link && (
                  <Link href={notif.link} onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="flex-shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
                {!notif.isRead && (
                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
