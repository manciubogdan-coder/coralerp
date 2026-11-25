import { Loader2, Mic, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useArgusVoice } from "@/hooks/useArgusVoice";

export function ArgusVoiceControls({ voice, disabled }: { voice: ReturnType<typeof useArgusVoice>; disabled: boolean }) {
  const micLabel = voice.recording ? "Trimite întrebarea vocală" : "Vorbește cu Argus";
  return <>
    <Button type="button" size="icon" variant={voice.recording ? "destructive" : "ghost"} className="h-8 w-8 shrink-0"
      title={voice.canRecord ? micLabel : "Microfon indisponibil în acest browser"} aria-label={micLabel} aria-pressed={voice.recording}
      disabled={!voice.canRecord || voice.transcribing || (disabled && !voice.recording)} onClick={() => voice.recording ? voice.stopRecording() : void voice.startRecording()}>
      {voice.transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : voice.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={voice.toggleEnabled}
      aria-label={voice.enabled ? "Oprește răspunsurile vocale" : "Activează răspunsurile vocale"} title={voice.enabled ? "Răspunsuri vocale pornite" : "Răspunsuri vocale oprite"} aria-pressed={voice.enabled}>
      {voice.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </Button>
    {voice.playing && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={voice.stopPlayback} title="Oprește redarea" aria-label="Oprește redarea"><Square className="h-4 w-4" /></Button>}
  </>;
}