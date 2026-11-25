import { expect, test } from 'bun:test';
import { argusMode, argusChatPath, futureImpact, sourceUrl, isOfficialFutureSource, type FutureChange } from '../../supabase/functions/_shared/futureConversationRules';
import { speechChunks } from '../../src/lib/argus/voiceRules';
import { SALES_PRICING_ACTIONS } from '../../supabase/functions/_shared/crmRules';

const change: FutureChange = { category: 'salarii', baselineLei: 36000, changePct: 12, exposurePct: 25, source: 'Cost citit în jurnal; pondere eligibilă confirmată; scenariu +12%', assumed: true };

test('existing conversations stay general and future conversations keep a distinct mode', () => {
  expect(argusMode(undefined)).toBe('general');
  expect(argusMode('future')).toBe('future');
  expect(() => argusMode('admin')).toThrow();
});

test('history and notifications return to the correct conversation module', () => {
  expect(argusChatPath('future', 'test-id')).toBe('/administrativ/argus/viitor/test-id');
  expect(argusChatPath(undefined, 'test-id')).toBe('/administrativ/argus/chat/test-id');
});

test('strategic chat and transcription do not widen sales permissions', () => {
  expect(SALES_PRICING_ACTIONS.has('chat')).toBe(false);
  expect(SALES_PRICING_ACTIONS.has('voice_transcribe')).toBe(false);
});

test('minimum-wage impact affects only the explicitly eligible cost share', () => {
  const result = futureImpact(3, 12, [change]);
  expect(result.monthlyLei).toBeCloseTo(360, 8);
  expect(result.horizonLei).toBeCloseTo(4320, 8);
  expect(result.assumptions).toEqual(['salarii']);
});

test('unknown exposure does not silently produce a real total', () => {
  const result = futureImpact(3, 12, [change, { ...change, category: 'transport', exposurePct: null }]);
  expect(result.complete).toBe(false);
  expect(result.monthlyLei).toBeNull();
  expect(result.horizonLei).toBeNull();
  expect(result.rows[0].monthlyLei).toBeCloseTo(360, 8);
  expect(result.missing).toEqual(['transport']);
});

test('known zero exposure remains zero, not unknown', () => {
  expect(futureImpact(1, 12, [{ ...change, exposurePct: 0 }]).horizonLei).toBe(0);
});

test('a decrease reduces the cost instead of showing a loss', () => {
  expect(futureImpact(3, 6, [{ ...change, changePct: -10 }]).horizonLei).toBe(-1800);
});

test('overlapping shocks cannot double-count the same cost category', () => {
  expect(() => futureImpact(3, 12, [change, { ...change, category: ' SALARII ' }])).toThrow();
});

test('impact rejects missing provenance and invalid exposure or periods', () => {
  expect(() => futureImpact(0, 12, [change])).toThrow();
  expect(() => futureImpact(3, 12, [{ ...change, source: '' }])).toThrow();
  expect(() => futureImpact(3, 12, [{ ...change, exposurePct: 101 }])).toThrow();
});

test('source links must be HTTPS and cannot contain credentials', () => {
  expect(sourceUrl('https://legislatie.just.ro/Public/DetaliiDocument/123')).toBe('https://legislatie.just.ro/Public/DetaliiDocument/123');
  expect(sourceUrl('javascript:alert(1)')).toBeNull();
  expect(sourceUrl('https://user:password@example.test')).toBeNull();
});

test('official-source checks reject lookalike domains and secondary press', () => {
  expect(isOfficialFutureSource('https://legislatie.just.ro/Public/DetaliiDocument/123')).toBe(true);
  expect(isOfficialFutureSource('https://eur-lex.europa.eu/legal-content/RO/TXT/')).toBe(true);
  expect(isOfficialFutureSource('https://legislatie.just.ro.example.test/article')).toBe(false);
  expect(isOfficialFutureSource('https://www.digi24.ro/article')).toBe(false);
});

test('long spoken answers retain all words below the existing voice service limit', () => {
  const text = Array.from({ length: 300 }, (_, i) => `cuvânt${i}`).join(' ');
  const chunks = speechChunks(text);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every(c => c.length <= 880)).toBe(true);
  expect(chunks.join(' ')).toBe(text);
  expect(speechChunks('')).toEqual([]);
});