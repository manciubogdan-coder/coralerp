export function recognizedNote(event: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }): string {
  return event.results?.[0]?.[0]?.transcript?.trim() ?? "";
}

export const EMPTY_NOTE_NOTICE = "Nu s-a auzit nicio notă. Poți dicta din nou sau scrie nota.";