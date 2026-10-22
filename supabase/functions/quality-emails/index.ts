import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@7.0.11';
import { z } from 'npm:zod@3.25.76';
import { LEGACY_URL, LEGACY_ANON, requireAdmin } from '../_shared/appData.ts';
import { createQualityEmail } from '../_shared/quality-email/report.ts';
import { localClock, shiftDay, dayBounds, isFinalized, qualitySnapshot } from '../_shared/quality-email/rules.ts';

const typeSchema = z.enum(['materii-prime','ambalaje','etichete']);
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(`${v}T12:00:00Z`).toISOString().slice(0,10) === v);
const routeSchema = z.object({ id: z.string().uuid().optional(), inventory_type: typeSchema, supplier_id: z.string().min(1).max(200), supplier_name: z.string().min(1).max(200), recipient_mode: z.enum(['supplier','manufacturer']), manufacturer_id: z.string().max(200).nullable().optional(), manufacturer_name: z.string().max(200).nullable().optional(), recipient_email: z.string().trim().email().max(254), cc_emails: z.array(z.string().trim().email().max(254)).max(30), language: z.enum(['ro','en','it']), version: z.enum(['v1','v2']), enabled: z.boolean() }).refine(r => r.recipient_mode !== 'manufacturer' || !!r.manufacturer_id, 'Alege producătorul.');
const settingsSchema = z.object({ inventory_type: typeSchema, enabled: z.boolean(), send_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), day_offset: z.union([z.literal(0),z.literal(1)]) });
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action:z.literal('get'),inventory_type:typeSchema }),
  z.object({ action:z.literal('settings'),settings:settingsSchema }),
  z.object({ action:z.literal('route'),route:routeSchema }),
  z.object({ action:z.literal('delete_route'),id:z.string().uuid() }),
  z.object({ action:z.literal('reviews'),inventory_type:typeSchema,ids:z.array(z.string().uuid()).max(50) }),
  z.object({ action:z.literal('finalize'),inventory_type:typeSchema,ids:z.array(z.string().uuid()).min(1).max(1000),finalized:z.boolean() }),
  z.object({ action:z.literal('verify') }),
  z.object({ action:z.literal('preview'),route_id:z.string().uuid(),day:daySchema }),
  z.object({ action:z.literal('send'),route_id:z.string().uuid(),day:daySchema }),
  z.object({ action:z.literal('scheduled'),inventory_type:typeSchema }),
]);
const json = (data: unknown, status=200) => new Response(JSON.stringify(data), { status, headers:{...corsHeaders,'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-app-token, x-quality-job`,'Content-Type':'application/json'} });
const prefix = (t:string) => t === 'materii-prime' ? '' : `${t}_`;
const tables = (t:string) => ({ reception:`${prefix(t)}reception_records`, supplier:`${prefix(t)}suppliers`, manufacturer:`${prefix(t)}manufacturers` });
async function all(client:any, table:string, apply:(q:any)=>any = q=>q) {
  const out:any[]=[]; let off=0;
  while (true) { const {data,error}=await apply(client.from(table).select('*')).range(off,off+999); if(error) throw new Error(`Citirea ${table} nu este disponibilă.`); out.push(...(data??[])); if(!data || data.length<1000) return out; off+=1000; }
}
async function batches(client:any,table:string,col:string,ids:string[]) {
  const rows:any[]=[]; for(let i=0;i<ids.length;i+=50) rows.push(...await all(client,table,q=>q.in(col,ids.slice(i,i+50)))); return rows;
}
const checked = async (query: any) => { const r=await query; if(r.error) throw new Error('Salvarea sau citirea setărilor a eșuat.'); return r.data; };
function smtp() {
  const pass=Deno.env.get('QUALITY_SMTP_PASSWORD'); if(!pass) throw new Error('Parola căsuței nu este configurată.');
  return nodemailer.createTransport({ host:'mail.coral-biogreens.ro', port:465, secure:true, auth:{user:'raport@coral-biogreens.ro',pass}, connectionTimeout:15000, greetingTimeout:15000, socketTimeout:30000, logger:false, debug:false });
}
async function reportFor(cloud:any,legacy:any,route:any,day:string) {
  const t=tables(route.inventory_type), bounds=dayBounds(day);
  const inv=await all(legacy,t.reception,q=>q.gte('receipt_date',bounds.start).lt('receipt_date',bounds.end).order('id'));
  const rows=inv.filter(r => (r.supplier_id || r.supplier_name || 'unknown')===route.supplier_id && (route.recipient_mode==='supplier' || r.manufacturer_id===route.manufacturer_id));
  const ids=rows.map(r=>r.id);
  const [reports,reviews,manufacturers,tols,missing]=await Promise.all([
    batches(legacy,'reception_report_data','inventory_id',ids),batches(cloud,'quality_email_reviews','inventory_id',ids),
    batches(legacy,t.manufacturer,'id',[...new Set(rows.map(r=>r.manufacturer_id).filter(Boolean))] as string[]),
    batches(legacy,'product_reception_tolerances','product_id',[...new Set(rows.map(r=>r.product_id).filter(Boolean))] as string[]),
    all(legacy,'reception_missing_items',q=>q.eq('inventory_type',route.inventory_type).eq('receipt_date',day)),
  ]);
  const rep=new Map(reports.map(r=>[r.inventory_id,r])),rev=new Map(reviews.filter(r=>r.inventory_type===route.inventory_type).map(r=>[r.inventory_id,r]));
  const unfinished=rows.filter(r=>!isFinalized(rev.get(r.id),r,rep.get(r.id)));
  const tolerances=Object.fromEntries(tols.map(r=>[r.product_id,{under:Number(r.tolerance_under_percent??3),over:Number(r.tolerance_over_kg??100)}]));
  const man=new Map(manufacturers.map(r=>[r.id,r.name]));
  const grouped=new Map<string,any>();
  for(const r of rows) {
    const group=grouped.get(r.document_number??'') ?? {supplierName:r.supplier_name||route.supplier_name,supplierId:r.supplier_id,documentNumber:r.document_number??'',rows:[]};
    const d:any=rep.get(r.id);
    group.rows.push({ inventory_id:r.id,product_id:r.product_id,denumire_produs:r.name,producator:man.get(r.manufacturer_id)||'',cantitate_receptionata:Number(r.original_quantity??r.net_quantity??0),unit:r.unit||'kg',cantitate_document:d?.cantitate_document==null?'':String(d.cantitate_document),pierdere_calitativa_procent:d?.pierdere_calitativa_procent==null?'':String(d.pierdere_calitativa_procent),nr_paleti_rec:r.pallet_count,lot_number:r.lot_number,defects:d?.defects??[],observations:d?.observations??'',photos:d?.photos??[] });
    grouped.set(r.document_number??'',group);
  }
  const missingRows=missing.filter(m=>(m.supplier_id||m.supplier_name||'unknown')===route.supplier_id);
  // Missing-item records have no verified producer identity: never leak them to a producer-specific route.
  if(route.recipient_mode==='supplier') for(const m of missingRows) {
    const key=m.document_number??''; const g=grouped.get(key)??{supplierName:route.supplier_name,supplierId:route.supplier_id,documentNumber:key,rows:[]};
    g.rows.push({inventory_id:'missing',product_id:m.product_id,denumire_produs:m.product_name,producator:'',cantitate_receptionata:0,unit:m.unit||'kg',cantitate_document:String(m.expected_quantity??0),pierdere_calitativa_procent:'',is_missing:true,defects:[],observations:m.notes??'',photos:[]});grouped.set(key,g);
  }
  const renderer=createQualityEmail(day,route.language,route.version,tolerances,p=> {
    const url=p.path?`${LEGACY_URL}/storage/v1/object/public/reception-photos/${p.path}`:p.url;
    return /^https:\/\//.test(url||'')?url:'';
  });
  const rendered=[...grouped.values()].map(g=>renderer.render(g));
  return {count:rows.length,unfinished:unfinished.length,html:rendered.map(r=>r.html).join('<hr/>'),text:rendered.map(r=>r.text).join('\n\n'),groups:grouped.size};
}
async function deliver(cloud:any,legacy:any,route:any,day:string,preview=false) {
  const report=await reportFor(cloud,legacy,route,day);
  if(preview) return report;
  const record=await checked(cloud.from('quality_email_deliveries').upsert({route_id:route.id,receipt_day:day,recipient_email:route.recipient_email,cc_emails:route.cc_emails},{onConflict:'route_id,receipt_day',ignoreDuplicates:true}));
  const existing=await checked(cloud.from('quality_email_deliveries').select('*').eq('route_id',route.id).eq('receipt_day',day).single());
  if(['sent','sending','uncertain'].includes(existing.status)) return {skipped:true,status:existing.status};
  if(!report.count || report.unfinished) {
    await checked(cloud.from('quality_email_deliveries').update({status:'waiting',receipt_count:report.count,detail:report.unfinished?`${report.unfinished} recepții fără calitate finalizată.`:'Nicio recepție pentru destinatar.',updated_at:new Date().toISOString()}).eq('id',existing.id));
    return {waiting:true,unfinished:report.unfinished,count:report.count};
  }
  const claimed=await checked(cloud.rpc('quality_email_claim',{p_id:existing.id})); if(!claimed) return {skipped:true};
  const transport=smtp(); let accepted=false;
  try {
    const result=await transport.sendMail({from:'SC Coral Biogreens SRL <raport@coral-biogreens.ro>',to:route.recipient_email,cc:[...new Set(route.cc_emails)].filter(e=>e!==route.recipient_email),subject:`${route.language==='ro'?'Raport calitativ':route.language==='it'?'Report qualitativo':'Quality report'} — ${route.supplier_name} — ${day}`,messageId:`<quality-${existing.id}@coral-biogreens.ro>`,html:report.html,text:report.text});
    accepted=true;
    const partial=result.rejected?.length>0;
    await checked(cloud.from('quality_email_deliveries').update({status:partial?'uncertain':'sent',message_id:result.messageId,receipt_count:report.count,detail:partial?'Serverul a respins unii destinatari. Verifică înainte de retrimitere.':null,updated_at:new Date().toISOString()}).eq('id',existing.id));
    return {sent:!partial,uncertain:partial};
  } catch(e) {
    // A lost connection after DATA can mean accepted email; never automatically duplicate it.
    const definite=!accepted && ['EAUTH','ECONNECTION','EDNS','EENVELOPE'].includes(e?.code);
    await checked(cloud.from('quality_email_deliveries').update({status:definite?'failed':'uncertain',detail:definite?'Conectarea sau autentificarea SMTP a eșuat.':'Trimitere neconfirmată. Verifică în căsuța de email înainte de orice retrimitere.',updated_at:new Date().toISOString()}).eq('id',existing.id));
    return {sent:false,error:definite?'Conectarea SMTP a eșuat.':'Trimitere neconfirmată.'};
  } finally {transport.close();}
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return json({ok:true});
  if(req.method!=='POST') return json({error:'Metodă neacceptată.'},405);
  try {
    const parsed=requestSchema.safeParse(await req.json()); if(!parsed.success) return json({error:'Verifică datele introduse.'},400);
    const b=parsed.data; const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(!url||!key) return json({error:'Serviciul nu este configurat.'},503);
    const cloud=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    let userId:string|undefined;
    if(b.action==='scheduled') {
      const secret=Deno.env.get('QUALITY_EMAIL_JOB_SECRET'); if(!secret || req.headers.get('x-quality-job')!==secret) return json({error:'Acces interzis.'},401);
    } else {
      const token=req.headers.get('x-app-token');
      if(['finalize','reviews'].includes(b.action)) {
        if(!token) return json({error:'Autentificare necesară.'},401);
        const authClient=createClient(LEGACY_URL,LEGACY_ANON,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
        const {data,error}=await authClient.auth.getUser(token); if(error||!data.user) return json({error:'Sesiune invalidă.'},401);
        const roles=await checked(authClient.from('app_user_roles').select('role').eq('user_id',data.user.id));
        if(!roles?.some(r=>['admin','calitate'].includes(r.role))) return json({error:'Acces rezervat echipei de calitate.'},403); userId=data.user.id;
      } else { const auth=await requireAdmin(token); if('error' in auth) return json({error:auth.status===403?'Setările emailurilor sunt disponibile administratorilor.':auth.error},auth.status); userId=auth.user.id; }
    }
    const legacy=createClient(LEGACY_URL,LEGACY_ANON,{auth:{persistSession:false,autoRefreshToken:false}});
    if(b.action==='get') {
      const [setting,routes,logs,suppliers,manufacturers]=await Promise.all([checked(cloud.from('quality_email_settings').select('*').eq('inventory_type',b.inventory_type).maybeSingle()),all(cloud,'quality_email_routes',q=>q.eq('inventory_type',b.inventory_type).order('created_at')),checked(cloud.from('quality_email_deliveries').select('*,quality_email_routes!inner(supplier_name,inventory_type)').eq('quality_email_routes.inventory_type',b.inventory_type).order('created_at',{ascending:false}).limit(100)),all(legacy,tables(b.inventory_type).supplier,q=>q.order('name')),all(legacy,tables(b.inventory_type).manufacturer,q=>q.order('name'))]);
      return json({settings:setting??{inventory_type:b.inventory_type,enabled:false,send_time:'17:00',day_offset:0},routes,logs,suppliers:suppliers.map(s=>({id:s.id,name:s.name,email:s.email})),manufacturers:manufacturers.map(m=>({id:m.id,name:m.name})),smtp_configured:!!Deno.env.get('QUALITY_SMTP_PASSWORD')});
    }
    if(b.action==='settings') {
      const secret=Deno.env.get('QUALITY_EMAIL_JOB_SECRET'); if(!secret) throw new Error('Programarea nu este configurată.');
      if(b.settings.enabled) {const transport=smtp();try{await transport.verify();}catch{throw new Error('Conectarea SMTP a eșuat. Automatizarea nu a fost activată.');}finally{transport.close();}}
      const old=await checked(cloud.from('quality_email_settings').select('*').eq('inventory_type',b.settings.inventory_type).maybeSingle());
      await checked(cloud.from('quality_email_settings').upsert({...b.settings,activated_on:old?.enabled?old.activated_on:localClock(new Date()).day,updated_at:new Date().toISOString()}));
      try {await checked(cloud.rpc('quality_email_schedule',{p_type:b.settings.inventory_type,p_time:b.settings.send_time,p_enabled:b.settings.enabled,p_url:`${url}/functions/v1/quality-emails`,p_secret:secret}));}catch(e){await cloud.from('quality_email_settings').update({enabled:false}).eq('inventory_type',b.settings.inventory_type);throw e;}
      return json({ok:true});
    }
    if(b.action==='route') {
      await checked(cloud.from('quality_email_settings').upsert({inventory_type:b.route.inventory_type},{onConflict:'inventory_type',ignoreDuplicates:true}));
      const routes=await all(cloud,'quality_email_routes',q=>q.eq('inventory_type',b.route.inventory_type).eq('supplier_id',b.route.supplier_id).eq('enabled',true));
      if(b.route.enabled && routes.some(r=>r.id!==b.route.id && (r.recipient_mode==='supplier'||b.route.recipient_mode==='supplier'||r.manufacturer_id===b.route.manufacturer_id))) return json({error:'Există deja o regulă care include aceleași recepții. Editeaz-o sau dezactiveaz-o.'},400);
      await checked(cloud.from('quality_email_routes').upsert(b.route));return json({ok:true});
    }
    if(b.action==='delete_route') { await checked(cloud.from('quality_email_routes').update({enabled:false}).eq('id',b.id)); return json({ok:true}); }
    if(b.action==='reviews') {
      const [reviews,rows,reports]=await Promise.all([all(cloud,'quality_email_reviews',q=>q.eq('inventory_type',b.inventory_type).in('inventory_id',b.ids)),batches(legacy,tables(b.inventory_type).reception,'id',b.ids),batches(legacy,'reception_report_data','inventory_id',b.ids)]);
      const rep=new Map(reports.map(r=>[r.inventory_id,r])),inv=new Map(rows.map(r=>[r.id,r]));
      return json({reviews:reviews.map(r=>({...r,finalized:isFinalized(r,inv.get(r.inventory_id),rep.get(r.inventory_id))}))});
    }
    if(b.action==='finalize') {
      const [rows,reports]=await Promise.all([batches(legacy,tables(b.inventory_type).reception,'id',b.ids),batches(legacy,'reception_report_data','inventory_id',b.ids)]);const rep=new Map(reports.map(r=>[r.inventory_id,r]));
      if(rows.length!==b.ids.length) return json({error:'Unele recepții nu mai sunt disponibile.'},400);
      if(b.finalized && rows.some(r=>rep.get(r.id)?.cantitate_document==null || Number(rep.get(r.id)?.cantitate_document)<0 || rep.get(r.id)?.pierdere_calitativa_procent==null || Number(rep.get(r.id)?.pierdere_calitativa_procent)<0 || Number(rep.get(r.id)?.pierdere_calitativa_procent)>100)) return json({error:'Completează și salvează cantitatea documentului și pierderea calitativă (0 pentru fără pierderi, maximum 100) înainte de finalizare.'},400);
      await checked(cloud.from('quality_email_reviews').upsert(rows.map(r=>({inventory_type:b.inventory_type,inventory_id:r.id,finalized:b.finalized,snapshot:qualitySnapshot(r,rep.get(r.id)),reviewed_by:userId,reviewed_at:new Date().toISOString()}))));return json({ok:true});
    }
    if(b.action==='verify') {const transport=smtp();try{await transport.verify();return json({ok:true});}catch{return json({error:'Nu s-a putut conecta căsuța. Verifică parola și setările serverului.'},400);}finally{transport.close();}}
    if(b.action==='preview'||b.action==='send') { const route=await checked(cloud.from('quality_email_routes').select('*').eq('id',b.route_id).single()); return json(await deliver(cloud,legacy,route,b.day,b.action==='preview')); }
    if(b.action==='scheduled') {
      const setting=await checked(cloud.from('quality_email_settings').select('*').eq('inventory_type',b.inventory_type).maybeSingle());const clock=localClock(new Date());
      if(!setting?.enabled || clock.time!==setting.send_time) return json({skipped:true});
      const routes=await all(cloud,'quality_email_routes',q=>q.eq('inventory_type',b.inventory_type).eq('enabled',true));
      const day=shiftDay(clock.day,-setting.day_offset); if(day<shiftDay(setting.activated_on,-setting.day_offset)) return json({skipped:true});
      const results=[]; for(const route of routes) { try { results.push(await deliver(cloud,legacy,route,day)); } catch {results.push({error:'Raportul nu a putut fi pregătit.'});} }
      return json({results});
    }
    return json({error:'Acțiune necunoscută.'},400);
  }catch(e){return json({error:e instanceof SyntaxError?'Date invalide.':e instanceof Error?e.message:'Operația a eșuat.'},400);}
});