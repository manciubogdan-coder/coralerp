import { FileText, Paperclip, X, Loader2, Download } from 'lucide-react';
import type { FileUIPart } from 'ai';
import { Button } from '@/components/ui/button';
import { PromptInputButton, PromptInputHeader, PromptInputSubmit, usePromptInputAttachments } from '@/components/ai-elements/prompt-input';
import { argusFetch } from '@/lib/argusApi';
import { toast } from '@/hooks/use-custom-toast';

export function PendingAttachments({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return <PromptInputHeader className="flex-wrap gap-2">
    {attachments.files.map(file => <div key={file.id} className="flex max-w-full items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs">
      {file.mediaType.startsWith('image/') ? <img src={file.url} alt={file.filename || 'Imagine'} className="h-9 w-9 rounded object-cover" /> : <FileText className="h-4 w-4 shrink-0" />}
      <span className="max-w-[180px] truncate" title={file.filename}>{file.filename}</span>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled={disabled} onClick={() => attachments.remove(file.id)} aria-label={`Elimină ${file.filename}`}><X className="h-3.5 w-3.5" /></Button>
    </div>)}
  </PromptInputHeader>;
}

export function AttachFilesButton({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();
  return <PromptInputButton disabled={disabled} onClick={attachments.openFileDialog} tooltip="Atașează poze, PDF, Excel sau Word" aria-label="Atașează fișiere"><Paperclip className="h-4 w-4" /></PromptInputButton>;
}

export function AttachmentSubmit({ status, preparing, text, onStop }: { status: 'submitted' | 'streaming' | 'ready' | 'error'; preparing: boolean; text: string; onStop: () => void }) {
  const attachments = usePromptInputAttachments();
  return <PromptInputSubmit status={preparing ? 'submitted' : status} onStop={onStop} disabled={preparing || ((!text.trim() && !attachments.files.length) && (status === 'ready' || status === 'error'))}>
    {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
  </PromptInputSubmit>;
}

export function SentAttachment({ file, threadId }: { file: FileUIPart; threadId: string }) {
  const download = async () => {
    try {
      const result = await argusFetch<{ url: string }>('attachment_download', { file: file.url, threadId });
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) { toast({ title: 'Fișierul nu poate fi descărcat', description: (error as Error).message, variant: 'destructive' }); }
  };
  return <Button variant="secondary" size="sm" className="my-1 max-w-full gap-2" onClick={download} title={file.filename}>
    <FileText className="h-4 w-4 shrink-0" /><span className="truncate">{file.filename || 'Document atașat'}</span><Download className="h-3.5 w-3.5 shrink-0" />
  </Button>;
}