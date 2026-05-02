import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Smartphone, Trash2, Download } from "lucide-react";
import {
  enablePushOnThisDevice,
  disablePushOnThisDevice,
  isThisDeviceSubscribed,
  isPushSupported,
  isPushAllowedHere,
  getPermissionState,
  sendTestPushToThisDevice,
} from "@/lib/pushNotifications";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

interface DeviceRow {
  id: string;
  endpoint: string;
  device_label: string | null;
  user_agent: string | null;
  last_used_at: string;
  created_at: string;
}

const PushNotificationsCard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [supported] = useState(() => isPushSupported());
  const [allowedHere] = useState(() => isPushAllowedHere());
  const [permission, setPermission] = useState<NotificationPermission>(getPermissionState());
  const [subscribedHere, setSubscribedHere] = useState(false);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);

  const loadDevices = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("push_subscriptions")
      .select("id,endpoint,device_label,user_agent,last_used_at,created_at")
      .eq("user_id", user.id)
      .order("last_used_at", { ascending: false });
    setDevices((data as DeviceRow[]) ?? []);
  };

  useEffect(() => {
    loadDevices();
    isThisDeviceSubscribed().then(setSubscribedHere);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    const r = await enablePushOnThisDevice();
    setLoading(false);
    if (r.ok) {
      toast({ title: "Notificări activate", description: "Vei primi push pe acest dispozitiv." });
      setSubscribedHere(true);
      setPermission(getPermissionState());
      await loadDevices();
    } else {
      toast({ title: "Eroare", description: r.error, variant: "destructive" });
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    const r = await disablePushOnThisDevice();
    setLoading(false);
    if (r.ok) {
      toast({ title: "Notificări dezactivate pe acest dispozitiv" });
      setSubscribedHere(false);
      await loadDevices();
    } else {
      toast({ title: "Eroare", description: r.error, variant: "destructive" });
    }
  };

  const handleRemoveDevice = async (id: string) => {
    if (!confirm("Ștergi acest dispozitiv? Nu va mai primi push notifications.")) return;
    await (supabase as any).from("push_subscriptions").delete().eq("id", id);
    await loadDevices();
    setSubscribedHere(await isThisDeviceSubscribed());
  };

  const handleInstall = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === "accepted") {
      toast({ title: "Aplicație instalată!", description: "Caut-o pe ecranul de start." });
    }
    setInstallPromptEvent(null);
  };

  const handleTest = async () => {
    setLoading(true);
    const r = await sendTestPushToThisDevice();
    setLoading(false);
    if (r.ok) {
      toast({ title: "Test trimis", description: "Verifică notificarea pe acest dispozitiv." });
    } else {
      toast({ title: "Test push eșuat", description: r.error, variant: "destructive" });
    }
  };

  if (!user) return null;

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore — iOS
      window.navigator.standalone === true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={18} /> Notificări push pe mobil
        </CardTitle>
        <CardDescription>
          Primește notificări direct pe telefon/tabletă (chat, taskuri, alerte) chiar și când aplicația e închisă.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* INSTALARE PWA */}
        {!isStandalone && (
          <div className="rounded-lg border border-dashed p-4 bg-muted/40">
            <div className="flex items-start gap-3">
              <Download className="mt-1 shrink-0" size={18} />
              <div className="flex-1 space-y-2">
                <div className="font-medium">Instalează aplicația</div>
                <p className="text-sm text-muted-foreground">
                  Pentru cea mai bună experiență (icon pe ecranul de start, badge cu număr de notificări, deschidere fullscreen),
                  instalează aplicația pe dispozitiv.
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><b>Android Chrome:</b> meniul ⋮ → "Instalează aplicația" / "Adaugă pe ecranul de start"</div>
                  <div><b>iPhone Safari:</b> butonul Share ⤴ → "Add to Home Screen"</div>
                </div>
                {installPromptEvent && (
                  <Button size="sm" onClick={handleInstall}>
                    <Download size={14} className="mr-2" /> Instalează acum
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STATUS + ACȚIUNI */}
        {!supported ? (
          <div className="text-sm text-muted-foreground">
            Browserul tău nu suportă push notifications.
          </div>
        ) : !allowedHere ? (
          <div className="text-sm text-muted-foreground">
            Push-urile nu pot fi activate din acest preview. Deschide aplicația publicată sau instalată pe dispozitiv.
          </div>
        ) : permission === "denied" ? (
          <div className="text-sm text-destructive">
            Ai blocat notificările pentru acest site. Deblochează-le din setările browserului (icon lacăt lângă URL → Notificări → Permite), apoi revino aici.
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            {subscribedHere ? (
              <>
                <Badge variant="default" className="gap-1"><Bell size={12} /> Activ pe acest dispozitiv</Badge>
                <Button variant="outline" size="sm" onClick={handleTest} disabled={loading}>
                  Test notificare
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisable} disabled={loading}>
                  <BellOff size={14} className="mr-2" /> Dezactivează aici
                </Button>
              </>
            ) : (
              <Button onClick={handleEnable} disabled={loading}>
                <Bell size={14} className="mr-2" />
                {loading ? "Se activează…" : "Activează push pe acest dispozitiv"}
              </Button>
            )}
          </div>
        )}

        {/* DEVICE LIST */}
        <div>
          <div className="text-sm font-medium mb-2">Dispozitive înregistrate ({devices.length})</div>
          {devices.length === 0 ? (
            <div className="text-sm text-muted-foreground">Niciun dispozitiv abonat încă.</div>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Smartphone size={16} className="shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {d.device_label || "Dispozitiv"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        Activ ultima dată: {format(new Date(d.last_used_at), "dd MMM yyyy HH:mm", { locale: ro })}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveDevice(d.id)}
                    className="text-destructive shrink-0"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PushNotificationsCard;
