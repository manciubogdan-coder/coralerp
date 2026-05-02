import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import UserAvatar from "@/components/UserAvatar";
import BackToHubButton from "@/components/BackToHubButton";
import { Camera, Save, Sun, Moon, Monitor, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PushNotificationsCard from "@/components/PushNotificationsCard";

type Mode = "light" | "dark" | "auto";
type Palette = "coral" | "blue" | "green" | "violet" | "mocha";

const PALETTES: { id: Palette; label: string; swatch: string }[] = [
  { id: "coral",  label: "Coral (default)", swatch: "hsl(0, 71%, 67%)" },
  { id: "blue",   label: "Albastru",        swatch: "hsl(217, 91%, 60%)" },
  { id: "green",  label: "Verde",           swatch: "hsl(142, 70%, 42%)" },
  { id: "violet", label: "Violet",          swatch: "hsl(262, 83%, 62%)" },
  { id: "mocha",  label: "Mocha",           swatch: "hsl(25, 60%, 45%)" },
];

const GRADIENTS: { id: string; label: string; css: string }[] = [
  { id: "none",   label: "Implicit (fără fundal)", css: "" },
  { id: "g1",     label: "Apus coral",   css: "linear-gradient(135deg,#ffe5d9 0%,#ffd6a5 100%)" },
  { id: "g2",     label: "Mentă",        css: "linear-gradient(135deg,#d8f3dc 0%,#b7e4c7 100%)" },
  { id: "g3",     label: "Cer",          css: "linear-gradient(135deg,#caf0f8 0%,#90e0ef 100%)" },
  { id: "g4",     label: "Lavandă",      css: "linear-gradient(135deg,#e0c3fc 0%,#8ec5fc 100%)" },
  { id: "g5",     label: "Crem",         css: "linear-gradient(135deg,#fef9e7 0%,#fcd5ce 100%)" },
  { id: "g6",     label: "Nopți",        css: "linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)" },
];

const ProfilePage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [palette, setPalette] = useState<Palette>("coral");
  const [chatBackground, setChatBackground] = useState<string>("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name || profile.name || "");
    setAvatarUrl(profile.avatar_url || null);
    setMode((profile.theme_mode as Mode) || "auto");
    setPalette((profile.theme_palette as Palette) || "coral");
    setChatBackground(profile.chat_background || "");
  }, [profile]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await (supabase as any).storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = (supabase as any).storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      toast({ title: "Poză încărcată", description: "Apasă Salvează pentru a aplica." });
    } catch (e: any) {
      toast({ title: "Eroare upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await (supabase as any).rpc("update_my_profile", {
        p_display_name: displayName,
        p_avatar_url: avatarUrl,
      });
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Profil salvat" });
    } catch (e: any) {
      toast({ title: "Eroare", description: e.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    try {
      const { error } = await (supabase as any).rpc("update_my_preferences", {
        p_theme_mode: mode,
        p_theme_palette: palette,
        p_chat_background: chatBackground || null,
      });
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Preferințe salvate" });
    } catch (e: any) {
      toast({ title: "Eroare", description: e.message, variant: "destructive" });
    } finally {
      setSavingPrefs(false);
    }
  };

  if (!profile) return <div className="p-6">Se încarcă…</div>;

  return (
    <div className="container mx-auto max-w-3xl p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profilul meu</h1>
        <BackToHubButton />
      </div>

      {/* DATE PERSONALE */}
      <Card>
        <CardHeader>
          <CardTitle>Date personale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <UserAvatar
              size="lg"
              name={displayName || profile.name}
              email={profile.email}
              url={avatarUrl}
            />
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Camera size={16} className="mr-2" />
                {uploading ? "Se încarcă..." : "Schimbă poza"}
              </Button>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setAvatarUrl(null)}
                >
                  <X size={14} className="mr-1" /> Elimină poza
                </Button>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Nume afișat</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Cum vrei să apari în chat și taskuri"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={profile.email} disabled />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={savingProfile}>
              <Save size={16} className="mr-2" />
              {savingProfile ? "Se salvează..." : "Salvează profilul"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ASPECT */}
      <Card id="aspect">
        <CardHeader>
          <CardTitle>Aspect & temă</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* MODE */}
          <div>
            <Label className="mb-2 block">Mod</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "light" as const, label: "Light", icon: Sun },
                { id: "dark"  as const, label: "Dark",  icon: Moon },
                { id: "auto"  as const, label: "Auto",  icon: Monitor },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    "border rounded-lg p-3 flex flex-col items-center gap-1 transition-colors",
                    mode === id
                      ? "border-primary bg-primary/10 ring-2 ring-primary"
                      : "hover:bg-accent"
                  )}
                >
                  <Icon size={20} />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* PALETA */}
          <div>
            <Label className="mb-2 block">Paletă de culori</Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPalette(p.id)}
                  className={cn(
                    "border rounded-lg p-3 flex flex-col items-center gap-2 transition-colors",
                    palette === p.id
                      ? "border-primary ring-2 ring-primary"
                      : "hover:bg-accent"
                  )}
                >
                  <span
                    className="h-8 w-8 rounded-full border"
                    style={{ background: p.swatch }}
                  />
                  <span className="text-xs text-center">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* FUNDAL CHAT */}
          <div>
            <Label className="mb-2 block">Fundal chat (gradient)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GRADIENTS.map((g) => {
                const selected = chatBackground === g.css;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setChatBackground(g.css)}
                    className={cn(
                      "border rounded-lg overflow-hidden h-20 relative transition-all",
                      selected ? "ring-2 ring-primary border-primary" : "hover:opacity-90"
                    )}
                    style={{ background: g.css || "hsl(var(--muted))" }}
                  >
                    {!g.css && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        <ImageIcon size={14} className="mr-1" /> Fără fundal
                      </span>
                    )}
                    <span className="absolute bottom-1 left-1 right-1 text-[10px] bg-background/70 rounded px-1 truncate">
                      {g.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={savePrefs} disabled={savingPrefs}>
              <Save size={16} className="mr-2" />
              {savingPrefs ? "Se salvează..." : "Salvează preferințele"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PUSH NOTIFICATIONS */}
      <PushNotificationsCard />
    </div>
  );
};

export default ProfilePage;
