import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3.25.76';
import { LEGACY_URL, LEGACY_ANON } from '../_shared/appData.ts';
import { CRM_STAGES, isInactive, canAccessCrm } from '../_shared/crmRules.ts';
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
 z.object({action:z.literal('simulate_orders'),customer_id:uuid})
]);
const headers={...corsHeaders,'Access-Control-Allow-Headers':`${corsHeaders['Access-Control-Allow-Headers']}, x-app-token`};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{...headers,'Content-Type':'application/json'}});
async function check(q:any){const r=await q;if(r.error)throw new Error('Operațiunea CRM nu a putut fi salvată.');return r.data;}
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
   const [customers,leads,interactions,orders,existingAlerts]=await Promise.all(['crm_customers','crm_leads','crm_interactions','crm_orders','crm_automated_alerts'].map(t=>all(db,t)));
   for(const c of customers){if(!leads.some((l:any)=>l.customer_id===c.id&&l.stage==='active'))continue;
    const real=orders.filter((o:any)=>o.customer_id===c.id&&o.source==='senior').map((o:any)=>o.order_date).sort().at(-1);const last=real||c.last_order_at;
    if(isInactive(last,c.frequency_days||c.order_frequency_days)){
     const body=`Ultima comandă: ${last}. Ritm obișnuit: ${c.frequency_days||c.order_frequency_days} zile.`;
     const prior=existingAlerts.find((a:any)=>a.customer_id===c.id&&a.kind==='inactivity');
     if(!prior)await check(db.from('crm_automated_alerts').insert({customer_id:c.id,kind:'inactivity',title:`${c.company} — fără comandă`,body}));
     else if(prior.body!==body)await check(db.from('crm_automated_alerts').update({body,status:'open',snoozed_until:null}).eq('id',prior.id));
    }
    else await check(db.from('crm_automated_alerts').update({status:'resolved'}).eq('customer_id',c.id).eq('kind','inactivity'));
   }
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
 }catch(e){const error=e as {statusCode?:number;message?:string};const status=error.statusCode||500;return json({error:status===500?'CRM nu este disponibil momentan. Reîncearcă.':error.message||'Analiza AI nu este disponibilă.'},status);}
 return json({ok:true});
});
