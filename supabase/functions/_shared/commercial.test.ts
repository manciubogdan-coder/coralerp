import { test, expect } from 'bun:test';
import { commercialSql, commercialSummary } from './commercial.ts';

test('commercial figures read directly from Senior, not the mirror', () => {
  const sql = commercialSql('2026-01-01', '2026-10-19');
  expect(sql).toContain('dbo.C_H_Note_Contabile h WITH (NOLOCK)');
  expect(sql).not.toContain('erp_mirror');
});
test('last selected day is included and cancelled documents excluded', () => {
  expect(commercialSql('2026-10-01', '2026-10-19')).toContain("h.Data < DATEADD(day,1,'2026-10-19')");
  expect(commercialSql('2026-10-01', '2026-10-19')).toContain('ISNULL(h.Anulat,0)=0');
});
test('invalid and reversed dates cannot become SQL', () => {
  for (const [start, end] of [['2026-02-30','2026-03-01'], ['2026-10-19','2026-10-01'], ["2026-01-01'; DROP",'2026-10-19']]) {
    expect(() => commercialSql(start, end)).toThrow();
  }
});
test('successful live results retain totals and declare live freshness', () => {
  const result = commercialSummary([{ section: 'metric', kind: 'sales_orders', documents: 2, value: 100 }], '2026-10-01','2026-10-19');
  expect(result.metrics.sales_orders).toMatchObject({ documents: 2, value: 100 });
  expect(result.live).toBe(true);
  expect(result.partial).toBe(false);
});
test('truncated results never become complete totals', () => {
  expect(() => commercialSummary(Array(500).fill({section:'metric'}), '2026-10-01','2026-10-19')).toThrow();
});