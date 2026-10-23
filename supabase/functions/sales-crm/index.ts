import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';
import { LEGACY_URL, LEGACY_ANON } from '../_shared/appData.ts';
import { CRM_STAGES, isInactive, canAccessCrm, orderFrequency } from '../_shared/crmRules.ts';
import {analyzeSentiment} from './sentiment.ts';
const uuid=z.string().uuid(), text=z.string().trim().max(500);
const contact=z.object({name:text.min(1),role:text,phone:text,email:z.union([z.string().email().max(254),z.literal('')])});
const customer=z.object({contacts:z.array(contact).max(20).default([]),frequency_days:z.number().positive().max(365).nullable().optional(),monthly_volume_kg:z.number().min(0).max(1e10).nullable().optional(),id:uuid.optional(),name:text.min(1),company:text.min(1),role:text,phone:text,email:z.union([z.string().email().max(254),z.literal('')]),delivery_locations:z.array(text).max(50),senior_erp_id:text,segment:z.enum(['Retail','IKA','HoReCa','Distribuitor','Catering']),order_frequency_days:z.number().int().min(1).max(365),last_order_at:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),stage:z.enum(CRM_STAGES),value:z.number().min(0).max(1e10),next_action:text,next_action_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()});
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('get')}),z.object({action:z.literal('sentiment'),body:z.string().trim().min(1).max(5000)}),z.object({action:z.literal('customer'),customer}),
 z.object({action:z.literal('stage'),customer_id:uuid,stage:z.enum(CRM_STAGES)}),
 z.object({action:z.literal('interaction'),customer_id:uuid,kind:z.enum(['call','note','feedback','email']),subject:text,body:z.string().trim().min(1).max(5000),rating:z.number().int().min(1).max(5).nullable(),batch:text,quality_issue:z.boolean(),sentiment:z.enum(['positive','neutral','negative']).nullable().optional()}),
 z.object({action:z.literal('alert'),id:uuid,status:z.enum(['resolved','snoozed'])}),
 z.object({action:z.literal('surplus'),customer_ids:z.array(uuid).min(1).max(100),title:text.min(1),body:z.string().min(1).max(2000)}),
 z.object({action:z.literal('simulate_orders'),customer_id:uuid}),
 z.object({action:z.literal('senior_sync'),month:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/)})
]);
const headers={...corsHeaders,'Access-Control-Allow-Headers':`${corsHeaders['Access-Control-Allow-Headers']}, x-app-token`};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...headers,'Content-Type':'application/json'}});
async function check(q:any){const r=await q;if(r.error){console.error('crm db',r.error.message);throw new Error('Operațiunea CRM nu a putut fi salvată.');}return r.data;}
async function allFast(db:any,table:string,cols='*'){const {count,error}=await db.from(table).select('id',{count:'exact',head:true});if(error)throw new Error('Operațiunea CRM nu a putut fi salvată.');const pages=Array.from({length:Math.ceil((count||0)/1000)},(_,i)=>i*1000);const out:any[]=[];for(let i=0;i<pages.length;i+=12){const chunk=await Promise.all(pages.slice(i,i+12).map(o=>check(db.from(table).select(cols).order('id').range(o,o+999))));for(const c of chunk)out.push(...c);}return out;}
// Greutatea se estimează din denumire (ex. „BUSUIOC 100 GR” × bucăți); fără greutate în nume rămâne necunoscută.
const kgFromSku=(sku:string,qty:number)=>{const m=sku.toUpperCase().match(/(\d+(?:[.,]\d+)?)\s*(KG|GR|G)(?![A-Z])/);if(!m)return null;const v=Number(m[1].replace(',','.'));return Math.round(qty*(m[2]==='KG'?v:v/1000)*1000)/1000;};
async function all(db:any,table:string){const rows:any[]=[];let offset=0;while(true){const data=await check(db.from(table).select('*').order('id').range(offset,offset+999));rows.push(...data);if(data.length<1000)return rows;offset+=1000;}}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return json({error:'Metodă neacceptată.'},405);
 try{
  const token=req.headers.get('x-app-token');if(!token)return json({error:'Autentificare necesară.'},401);
  const legacy=createClient(LEGACY_URL,LEGACY_ANON,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data,error}=await legacy.auth.getUser(token);if(error||!data.user)return json({error:'Sesiune invalidă.'},401);
  const [profile,roles]=await Promise.all([check(legacy.from('app_profiles').select('approved').eq('user_id',data.user.id).maybeSingle()),check(legacy.from('app_user_roles').select('role').eq('user_id',data.user.id))]);
  if(!canAccessCrm(profile?.approved===true,roles.map((r:any)=>r.role)))return json({error:'Acces rezervat echipei Vânzări.'},403);
  const parsed=schema.safeParse(await req.json());if(!parsed.success)return json({error:'Verifică datele introduse.'},400);const b=parsed.data;
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)return json({error:'CRM indisponibil.'},503);
  const db=createClient(url,key,{auth:{persistSession:false}});
  if(b.action==='sentiment'){const output=await analyzeSentiment(b.body,req.signal);const h=new Headers(headers);output.headers.forEach((v,k)=>h.set(k,v));h.set('Content-Type','application/json');return new Response(JSON.stringify({sentiment:output.sentiment}),{headers:h});}
  if(b.action==='get'){
   const [customers,leads,interactions,orders,existingAlerts]=await Promise.all(['crm_customers','crm_leads','crm_interactions','crm_orders','crm_automated_alerts'].map(t=>t==='crm_orders'?allFast(db,t,'id,customer_id,order_date,sku,quantity,quantity_kg,amount,unit,document_id,status,source'):all(db,t)));
   const activeIds=new Set(leads.filter((l:any)=>l.stage==='active').map((l:any)=>l.customer_id));const datesBy=new Map<string,string[]>();for(const o of orders){if(o.source!=='senior')continue;const l=datesBy.get(o.customer_id);if(l)l.push(o.order_date);else datesBy.set(o.customer_id,[o.order_date]);}
   const writes:any[]=[];
   for(const c of customers){if(!activeIds.has(c.id))continue;
    const dates=(datesBy.get(c.id)||[]).sort();const real=dates.at(-1);const last=real||c.last_order_at;const frequency=orderFrequency(dates,c.frequency_days||c.order_frequency_days);
    if(isInactive(last,frequency)){
     const body=`Ultima comandă: ${last}. Ritm obișnuit: ${frequency} zile.`;
     const prior=existingAlerts.find((a:any)=>a.customer_id===c.id&&a.kind==='inactivity');
     if(!prior)writes.push(()=>check(db.from('crm_automated_alerts').upsert({customer_id:c.id,kind:'inactivity',title:`${c.company} — fără comandă`,body},{onConflict:'customer_id,kind',ignoreDuplicates:true})));
     else if(prior.body!==body)writes.push(()=>check(db.from('crm_automated_alerts').update({body,status:'open',snoozed_until:null}).eq('id',prior.id)));
    }
    else if(existingAlerts.some((a:any)=>a.customer_id===c.id&&a.kind==='inactivity'&&a.status!=='resolved'))writes.push(()=>check(db.from('crm_automated_alerts').update({status:'resolved'}).eq('customer_id',c.id).eq('kind','inactivity')));
   }
   for(let i=0;i<writes.length;i+=20)await Promise.all(writes.slice(i,i+20).map(w=>w()));
   return json({customers,leads,interactions,orders,alerts:await all(db,'crm_automated_alerts')});
  }
  if(b.action==='customer'){
   const {id,stage,value,monthly_volume_kg,next_action,next_action_date,...fields}=b.customer;
   const previous=id?await check(db.from('crm_leads').select('stage,stage_changed_at').eq('customer_id',id).maybeSingle()):null;
   const saved=await check(id?db.from('crm_customers').update({...fields,updated_at:new Date().toISOString()}).eq('id',id).select().single():db.from('crm_customers').insert({...fields,created_by:data.user.id}).select().single());
   await check(db.from('crm_leads').upsert({customer_id:saved.id,stage,value,monthly_volume_kg,next_action,next_action_date,stage_changed_at:previous?.stage===stage?previous.stage_changed_at:new Date().toISOString()},{onConflict:'customer_id'}));return json({ok:true});
  }
  if(b.action==='stage'){const previous=await check(db.from('crm_leads').select('stage').eq('customer_id',b.customer_id).maybeSingle());if(previous?.stage===b.stage)return json({ok:true});await check(db.from('crm_leads').update({stage:b.stage,stage_changed_at:new Date().toISOString()}).eq('customer_id',b.customer_id));return json({ok:true});}
  if(b.action==='interaction'){
   const {action,...fields}=b;let notified=false;let recipients=0;
   const interaction=await check(db.from('crm_interactions').insert({...fields,created_by:data.user.id,qa_notified:false}).select().single());
   if(b.quality_issue){const r=await legacy.rpc('emit_notification_event',{p_event_key:'quality.completed',p_title_default:`CRM: problemă de calitate — ${b.subject}`,p_body:`Lot ${b.batch||'nespecificat'}: ${b.body}`,p_link:'/vanzari?tab=crm',p_payload:{source:'crm',customer_id:b.customer_id}});notified=!r.error&&Number(r.data)>0;recipients=Number(r.data)||0;if(notified)await check(db.from('crm_interactions').update({qa_notified:true}).eq('id',interaction.id));}
   if(b.quality_issue)await check(db.from('crm_automated_alerts').upsert({customer_id:b.customer_id,kind:'quality',title:b.subject||'Problemă de calitate',body:`Lot ${b.batch||'nespecificat'} · ${b.body}`,status:'open',snoozed_until:null},{onConflict:'customer_id,kind'}));
   return json({ok:true,qa_notified:notified,recipients});
  }
  if(b.action==='alert'){await check(db.from('crm_automated_alerts').update({status:b.status,snoozed_until:b.status==='snoozed'?new Date(Date.now()+86400000).toISOString():null}).eq('id',b.id));return json({ok:true});}
  if(b.action==='surplus'){await check(db.from('crm_automated_alerts').upsert(b.customer_ids.map(id=>({customer_id:id,kind:'surplus',title:b.title,body:b.body,status:'open',snoozed_until:null})),{onConflict:'customer_id,kind'}));return json({ok:true});}
  if(b.action==='simulate_orders'){
   const existing=await check(db.from('crm_orders').select('id').eq('customer_id',b.customer_id).eq('source','simulation').limit(1));if(existing.length)return json({ok:true});
   await check(db.from('crm_orders').insert([0,3,7].map((days,i)=>({customer_id:b.customer_id,order_date:new Date(Date.now()-days*86400000).toISOString().slice(0,10),sku:['Baby spanac 200 g','Rucola 100 g','Mix salată 250 g'][i],quantity:[120,80,160][i],quantity_kg:[24,8,40][i],amount:[420,190,560][i],unit:'caserole',document_id:`SIM-${crypto.randomUUID().slice(0,8)}`,status:i===0?'În pregătire':'Livrat',source:'simulation'}))));return json({ok:true});
   }
   if(b.action==='senior_sync'){
    // Citire directă din Senior, câte o lună pe apel (interfața parcurge lunile și arată progresul).
    // Doar comenzile de client (CC), grupate pe document+produs; clienții se creează doar dacă au comenzi.
    const [y,mo]=b.month.split('-').map(Number);const mStart=`${b.month}-01`;const next=new Date(Date.UTC(y,mo,1)).toISOString().slice(0,10);
    const enqueue=async(sql:string)=>{const r=await db.rpc('erp_live_enqueue',{p_kind:'sql',p_payload:{sql}});if(r.error)throw new Error('Coada de citire Senior nu răspunde.');return r.data as string;};
    const deadline=Date.now()+100000;const waitAll=async(ids:string[])=>{const until=Math.min(Date.now()+60000,deadline);const out=new Map<string,any>();const pending=new Set(ids);
     while(pending.size&&Date.now()<until){await new Promise(r=>setTimeout(r,600));
      await Promise.all([...pending].map(async id=>{const {data:s}=await db.rpc('erp_live_get',{p_id:id});
       if(s?.status==='done'){out.set(id,s.result);pending.delete(id);}else if(s?.status==='error'){pending.delete(id);out.set(id,{__error:s.error||'Eroare la citirea din Senior.'});}}));}
     if(pending.size)throw Object.assign(new Error('Serverul Senior nu a răspuns în timp util. Verifică dacă programul de citire rulează pe server.'),{statusCode:504});return out;};
    const sql=(off:number)=>`SELECT CONVERT(char(10), h.Data, 23) AS d, pp.Partener_ID AS pid, MAX(pp.Partener_Denumire) AS partner, d.Denumire AS sku, CAST(h.Numar_Document_Primar AS varchar(20)) AS docid, SUM(CAST(d.Cantitate AS float)) AS qty, SUM(CAST(d.Valoare_Neta_Rol AS float)) AS amount FROM dbo.C_H_Note_Contabile h WITH (NOLOCK) JOIN dbo.C_Tipuri_Document t WITH (NOLOCK) ON t.Tip_Document_ID = h.Tip_Document_ID JOIN dbo.C_H_Note_Contabile_Parteneri pp WITH (NOLOCK) ON pp.H_ID = h.H_ID JOIN dbo.C_D_Note_Contabile d WITH (NOLOCK) ON d.H_ID = h.H_ID WHERE t.Cod = 'CC' AND ISNULL(h.Anulat,0)=0 AND h.Data >= '${mStart}' AND h.Data < '${next}' GROUP BY h.Data, pp.Partener_ID, d.Denumire, h.H_ID, h.Numar_Document_Primar ORDER BY h.H_ID, d.Denumire OFFSET ${off} ROWS FETCH NEXT 500 ROWS ONLY`;
    // Cititorul Senior întoarce maximum 500 de rânduri pe interogare: 8 pagini în paralel pe rundă.
    const page=(from:number)=>Array.from({length:8},(_,i)=>from+i*500);const rows:any[]=[];let offs=page(0);
    for(let round=0;round<6&&offs.length;round++){
     const ids=await Promise.all(offs.map(o=>enqueue(sql(o))));const out=await waitAll(ids);let full=false;
     ids.forEach((id,i)=>{const v=out.get(id);if(v&&v.__error)throw Object.assign(new Error(`Senior: ${String(v.__error).slice(0,200)}`),{statusCode:502});const r=Array.isArray(v)?v:[];rows.push(...r);if(i===ids.length-1&&r.length>=500)full=true;});
     offs=full?page(offs[offs.length-1]+500):[];}
    // Clienți: potrivire după ID Senior, creare în bloc pentru cei noi.
    const customers=await all(db,'crm_customers');const bySenior=new Map<string,any>(customers.filter((c:any)=>c.senior_erp_id).map((c:any)=>[String(c.senior_erp_id),c]));
    const names=new Map<string,string>();for(const r of rows)if(!bySenior.has(String(r.pid)))names.set(String(r.pid),String(r.partner||`Client ${r.pid}`).trim().slice(0,200)||`Client ${r.pid}`);
    const fresh=[...names].map(([pid,name])=>({name,company:name,role:'',phone:'',email:'',delivery_locations:[],senior_erp_id:pid,segment:'Distribuitor',order_frequency_days:30,last_order_at:null,contacts:[],created_by:data.user.id}));
    for(let i=0;i<fresh.length;i+=500){const saved=await check(db.from('crm_customers').insert(fresh.slice(i,i+500)).select());for(const c of saved)bySenior.set(String(c.senior_erp_id),c);
     await check(db.from('crm_leads').upsert(saved.map((c:any)=>({customer_id:c.id,stage:'active',value:0,next_action:'',next_action_date:null,stage_changed_at:new Date().toISOString()})),{onConflict:'customer_id'}));}
    // Rescrie doar comenzile Senior din luna respectivă.
    await check(db.from('crm_orders').delete().eq('source','senior').gte('order_date',mStart).lt('order_date',next));
    const lastOrder=new Map<string,string>();
    const inserts=rows.filter(r=>Number(r.qty)>0&&(r.amount==null||Number(r.amount)>=0)).map(r=>{const c=bySenior.get(String(r.pid));const day=String(r.d).slice(0,10);if(!lastOrder.has(c.id)||day>lastOrder.get(c.id)!)lastOrder.set(c.id,day);
     return {customer_id:c.id,order_date:day,sku:String(r.sku||'').slice(0,200),quantity:Number(r.qty)||0,quantity_kg:kgFromSku(String(r.sku||''),Number(r.qty)||0),amount:r.amount==null?null:Number(r.amount),unit:'buc',document_id:`CC-${r.docid}`.slice(0,120),status:'Comandă',source:'senior'};});
    for(let i=0;i<inserts.length;i+=1000)await check(db.from('crm_orders').insert(inserts.slice(i,i+1000)));
    const updates=[...lastOrder].filter(([cid,day])=>{const c=customers.find((x:any)=>x.id===cid);return !c?.last_order_at||day>c.last_order_at;});
    for(let i=0;i<updates.length;i+=25)await Promise.all(updates.slice(i,i+25).map(([cid,day])=>check(db.from('crm_customers').update({last_order_at:day,updated_at:new Date().toISOString()}).eq('id',cid))));
    return json({ok:true,month:b.month,clienti:lastOrder.size,clienti_noi:fresh.length,comenzi:inserts.length,documente:new Set(rows.map(r=>r.docid)).size});
   }
 }catch(e){const error=e as {statusCode?:number;message?:string};const status=error.statusCode||500;console.error('sales-crm',error.message);return json({error:status===500?'CRM nu este disponibil momentan. Reîncearcă.':error.message||'Analiza AI nu este disponibilă.'},status);}
 return json({ok:true});
});
