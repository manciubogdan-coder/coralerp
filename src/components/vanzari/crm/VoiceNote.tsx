import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EMPTY_NOTE_NOTICE, recognizedNote } from '@/lib/crm/voiceInput';

export default function VoiceNote({ onText }: { onText: (value: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const ref = useRef<InstanceType<Window['SpeechRecognition']> | null>(null);
  const ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  useEffect(() => () => { const r = ref.current; if (!r) return; r.onend = null; r.onresult = null; r.onerror = null; r.stop(); }, []);

  const toggle = () => {
    if (recording) { ref.current?.stop(); return; }
    if (!ctor) return;
    const r = new ctor(); ref.current = r;
    let heard = false, failed = false;
    r.lang = 'ro-RO'; r.continuous = false; r.interimResults = false;
    r.onresult = e => {
      const text = recognizedNote(e);
      if (!text) { setNotice(EMPTY_NOTE_NOTICE); return; }
      heard = true; setNotice(''); onText(text);
    };
    r.onend = () => { setRecording(false); if (!heard && !failed) setNotice(EMPTY_NOTE_NOTICE); };
    r.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') setNotice(EMPTY_NOTE_NOTICE);
      else { failed = true; setError('Microfon indisponibil. Poți scrie nota.'); }
      setRecording(false);
    };
    setError(''); setNotice('');
    try { r.start(); setRecording(true); }
    catch { setError('Dictarea nu a putut porni.'); setRecording(false); }
  };

  return <div className="flex items-center flex-wrap gap-2">
    <Button type="button" size="sm" variant="outline" disabled={!ctor} title={ctor ? 'Dictează nota în română' : 'Dictarea nu este disponibilă în acest browser'} onClick={toggle}>
      {recording ? <Square /> : <Mic />}{recording ? 'Oprește dictarea' : 'Dictează nota'}
    </Button>
    {notice && <span role="status" className="text-xs text-muted-foreground">{notice}</span>}
    {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
  </div>;
}
