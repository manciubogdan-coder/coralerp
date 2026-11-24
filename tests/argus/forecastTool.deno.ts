import { purchasingForecast } from '../../supabase/functions/argus/forecastTool.ts';
import type { Clients } from '../../supabase/functions/argus/data.ts';

function fixture(snapshot = true) {
  const data: Record<string, any[]> = {
    products: [{id:'r',name:'Rucola',default_unit:'kg'}],
    daily_stock_snapshots: snapshot ? [{id:'s',name:'Rucola',product_id:'old',quantity:3000,unit:'kg',snapshot_date:'2026-11-24'}] : [],
    reception_records: [{id:'rec',name:'Rucola',unit:'kg',original_quantity:300,receipt_date:'2026-11-25'}],
    stock_transfers: [{id:'t',transfer_date:'2026-11-17',destination:'Producție'}],
    inventory_history: [],
    product_orders: [{id:'o',product_id:'r',quantity_ordered:500,expected_delivery_date:'2026-11-25',status:'ordered'}],
    inventory: [{id:'current',product_id:'r',name:'Rucola',quantity:10,unit:'kg'}, {id:'oldlot',product_id:'r',name:'Rucola',quantity:0,unit:'g',lot_number:'consumed'}],
    stock_transfer_items: Array.from({length:1201},(_,i)=>({id:`i${i}`,transfer_id:'t',inventory_item_id:'oldlot',net_quantity:2000,quantity:2100,unit:'g'})),
  };
  const calls: string[] = [];
  const legacy = {from(table:string) {
    calls.push(table); let rows=[...(data[table]||[])];
    const b = { select:()=>b, order:()=>b, gte:()=>b, lte:()=>b,
      gt:(field:string,n:number)=>{rows=rows.filter(r=>r[field]>n);return b;},
      eq:(field:string,v:unknown)=>{rows=rows.filter(r=>r[field]===v);return b;},
      in:(field:string,v:unknown[])=>{if(field!=='action')rows=rows.filter(r=>v.includes(r[field]));return b;},
      range:async(a:number,z:number)=>({data:rows.slice(a,z+1),error:null})};return b;
  }};
  return {c:{legacy,legacyUser:legacy,cloud:legacy} as unknown as Clients,calls};
}
Deno.test('rucola consumes all 1201 transfer lines, including zero-stock original lots and grams',async()=>{
  const {c}=fixture();const result=await purchasingForecast(c,'rucola','materii-prime',3,'2026-11-24');
  if(!('produse' in result)||!result.produse)throw new Error('No product');const p=result.produse[0];
  if(p.total_28_zile!==2402||p.medie_pe_zile[1]!==600.5)throw new Error('Truncated or wrong-unit consumption');
  if(p.stoc_fizic_acum!==10||p.stoc_inceput_azi!==3000)throw new Error('Current stock confused with opening snapshot');
  if(p.proiectie[0].stoc_final!==2399.5||p.proiectie[1].stoc_final!==2699.5)throw new Error('Receipt must replace its day order, not add both');
});
Deno.test('missing product snapshot cannot turn current stock into forecast opening',async()=>{
  const {c}=fixture(false);const result=await purchasingForecast(c,'rucola','materii-prime',3,'2026-11-24');
  if(!('produse' in result)||!result.produse)throw new Error('No product');const p=result.produse[0];
  if(p.stoc_inceput_azi!==null||p.proiectie.length||!p.avertisment)throw new Error('Unverified coverage presented as real');
});