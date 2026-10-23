import type { FileUIPart } from 'ai';

export const ARGUS_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT = 250000;
export type PreparedFile = { text: string; images: string[] };

export async function prepareArgusFile(part: FileUIPart): Promise<{ file: File; prepared: PreparedFile }> {
  const blob = await (await fetch(part.url)).blob();
  const file = new File([blob], part.filename || 'document', { type: blob.type || part.mediaType });
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Fișierul trebuie să aibă între 1 octet și 25 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  const prepared: PreparedFile = { text: '', images: [] };
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Imaginea nu poate fi citită.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      prepared.images.push(canvas.toDataURL('image/jpeg', 0.9));
    } finally { bitmap.close(); }
  } else if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    try {
      if (pdf.numPages > 80) throw new Error('PDF-ul are peste 80 de pagini. Împarte-l în documente mai mici.');
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
        prepared.text += `\n--- Pagina ${n} ---\n${text}`;
        if (text.replace(/\s/g, '').length < 80) {
          if (prepared.images.length >= 30) throw new Error('PDF-ul are peste 30 de pagini scanate. Împarte-l în documente mai mici.');
          const viewport = page.getViewport({ scale: 1.7 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Pagina PDF nu poate fi citită.');
          await page.render({ canvasContext: ctx, viewport }).promise;
          prepared.images.push(canvas.toDataURL('image/jpeg', 0.88));
          canvas.width = 0; canvas.height = 0;
        }
        page.cleanup();
      }
    } finally { await pdf.destroy(); }
  } else if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    prepared.text = workbook.SheetNames.map(name => `\n--- Foaia: ${name} ---\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: '\t' })}`).join('\n');
  } else if (ext === 'docx') {
    const mammoth = await import('mammoth');
    prepared.text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  } else if (ext === 'txt') prepared.text = await file.text();
  else throw new Error('Format neacceptat. Pentru Word vechi (.doc), salvează documentul ca .docx sau PDF.');
  if (prepared.text.length > MAX_TEXT) throw new Error('Documentul conține prea mult text. Împarte-l în fișiere mai mici.');
  if (!prepared.text.trim() && !prepared.images.length) throw new Error('Nu am găsit text sau imagini lizibile în fișier.');
  return { file, prepared };
}