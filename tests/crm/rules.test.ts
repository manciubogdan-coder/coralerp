import {test,expect} from 'bun:test';
import {isInactive,alertVisible,CRM_STAGES} from '../../supabase/functions/_shared/crmRules';
test('pipeline follows the five requested stages',()=>expect([...CRM_STAGES]).toEqual(['lead','discovery','samples','negotiation','active']));
test('inactivity starts after the usual frequency, not on the expected order day',()=>{expect(isInactive('2026-10-16',7,new Date('2026-10-23T12:00:00Z'))).toBe(false);expect(isInactive('2026-10-15',7,new Date('2026-10-23T12:00:00Z'))).toBe(true);expect(isInactive(null,7)).toBe(false);});
test('snoozed alerts return after their deadline; resolved alerts stay hidden',()=>{const now=new Date('2026-10-23T12:00:00Z');expect(alertVisible({status:'snoozed',snoozed_until:'2026-10-24T12:00:00Z'},now)).toBe(false);expect(alertVisible({status:'snoozed',snoozed_until:'2026-10-23T11:00:00Z'},now)).toBe(true);expect(alertVisible({status:'resolved'},now)).toBe(false);});
