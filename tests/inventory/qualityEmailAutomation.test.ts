import { expect, test } from 'bun:test';
import { localClock, shiftDay, dayBounds, isFinalized, qualitySnapshot } from '../../supabase/functions/_shared/quality-email/rules';
import { createQualityEmail } from '../../supabase/functions/_shared/quality-email/report';

test('send time is evaluated in Bucharest, including winter time',()=>{
  expect(localClock(new Date('2026-10-22T14:00:00Z'))).toEqual({day:'2026-10-22',time:'17:00'});
  expect(localClock(new Date('2026-10-26T15:00:00Z'))).toEqual({day:'2026-10-26',time:'17:00'});
});
test('next-day delivery selects the previous reception day',()=>{
  expect(shiftDay('2026-10-23',-1)).toBe('2026-10-22');
  expect(shiftDay('2026-10-22',0)).toBe('2026-10-22');
});
test('daily reception filters cover the complete DST transition day',()=>{
  expect(dayBounds('2026-10-25')).toEqual({start:'2026-10-24T21:00:00.000Z',end:'2026-10-25T22:00:00.000Z'});
  expect(dayBounds('2026-03-29')).toEqual({start:'2026-03-28T22:00:00.000Z',end:'2026-03-29T21:00:00.000Z'});
});
test('unreviewed or modified reception quality is deferred',()=>{
  const row={name:'Busuioc',original_quantity:2.9};const report={cantitate_document:2.9,pierdere_calitativa_procent:5};
  const snapshot=qualitySnapshot(row,report);const reordered=Object.fromEntries(Object.entries(snapshot).reverse());
  expect(isFinalized({finalized:true,snapshot:reordered},row,report)).toBe(true);
  expect(isFinalized({finalized:false,snapshot},row,report)).toBe(false);
  expect(isFinalized({finalized:true,snapshot},row,{...report,pierdere_calitativa_procent:6})).toBe(false);
});
test('scheduled quality report preserves inclusive credit calculation for each supplier language and version',()=>{
  const group:any={supplierName:'Test',documentNumber:'1',rows:[{denumire_produs:'Busuioc',producator:'Test',unit:'kg',cantitate_document:'2.9',cantitate_receptionata:2.9,pierdere_calitativa_procent:'5',defects:[],observations:'',photos:[]}]};
  for(const lang of ['ro','en','it'] as const) for(const version of ['v1','v2'] as const) {
    const r=createQualityEmail('2026-10-22',lang,version);expect(r.getQualityLines(group,lang)[0].creditKg).toBe(0.15);
    group.rows[0].pierdere_calitativa_procent='4.99';expect(r.getQualityLines(group,lang)[0].creditKg).toBe(0);
    group.rows[0].pierdere_calitativa_procent='5';
  }
});

test('Rucola supplier reports claim quality on 638kg and shortage of 33kg separately',()=>{
  const row:any={denumire_produs:'Rucola',producator:'De Divitiis',unit:'kg',cantitate_document:'671',cantitate_receptionata:638,pierdere_calitativa_procent:'30',defects:[],observations:'',photos:[]};
  for(const lang of ['ro','en','it'] as const) for(const version of ['v1','v2'] as const) {
    const renderer=createQualityEmail('2026-10-28',lang,version);
    for (const rows of [[row], [row,{...row,cantitate_document:'505',cantitate_receptionata:494,pierdere_calitativa_procent:'0'}]]) {
      const group:any={supplierName:'De Divitiis',documentNumber:'1',rows};
      const result=renderer.getQualityLines(group,lang)[0];
      expect(result.creditKg).toBe(191);
      expect(renderer.getEmailTableRows(group,lang)[0].credit).toBe('191kg');
      if(rows.length===1) {
        expect(result.shortageKg).toBe(33);
        expect(result.recvQty).toBe(638);
      }
    }
  }
});