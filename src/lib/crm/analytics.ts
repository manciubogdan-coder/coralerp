import {orderFrequency} from '../../../supabase/functions/_shared/crmRules';
import type {Customer,CrmData,Order} from './model';
export const dayKey=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const number=(n:number,digits=1)=>new Intl.NumberFormat('ro-RO',{maximumFractionDigits:digits}).format(n);
export const segmentName=(s:string)=>s==='Retail'||s==='IKA'?'Comerț modern (IKA)':s;
export function daysSince(value:string|null,now=new Date()):number|null {if(!value)return null;const n=Math.floor((Date.parse(dayKey(now))-Date.parse(value.slice(0,10)))/86400000);return Number.isFinite(n)?Math.max(0,n):null;}
export const relevantOrders=(orders:Order[],example:boolean)=>orders.filter(o=>o.source===(example?'simulation':'senior'));
export function customerStats(customer:Customer,orders:Order[],example:boolean,now=new Date()) {
 const rows=relevantOrders(orders,example).filter(o=>o.customer_id===customer.id&&o.order_date<=dayKey(now));
 const dates=[...new Set(rows.map(o=>o.order_date.slice(0,10)))].sort();
 const documents=new Map<string,Order[]>();for(const o of rows){const key=o.document_id||o.id;documents.set(key,[...(documents.get(key)||[]),o]);}
 const amounts=[...documents.values()].filter(lines=>lines.every(o=>o.amount!=null)).map(lines=>lines.reduce((s,o)=>s+Number(o.amount),0));
 const kg=[...documents.values()].filter(lines=>lines.every(o=>o.quantity_kg!=null)).map(lines=>lines.reduce((s,o)=>s+Number(o.quantity_kg),0));
 const pieces=[...documents.values()].filter(lines=>lines.every(o=>o.unit==='caserole'||o.unit==='buc')).map(lines=>lines.reduce((s,o)=>s+Number(o.quantity),0));
 const frequency=orderFrequency(dates,Number(customer.frequency_days||customer.order_frequency_days));
 const last=dates.at(-1)||customer.last_order_at;const elapsed=daysSince(last,now);const risk=elapsed!=null&&elapsed>frequency;
 return {rows,frequency,last,elapsed,risk,status:elapsed==null?'none':risk?'risk':'active',averageValue:amounts.length?amounts.reduce((s,n)=>s+n,0)/amounts.length:null,averageKg:kg.length?kg.reduce((s,n)=>s+n,0)/kg.length:null,averagePieces:pieces.length?pieces.reduce((s,n)=>s+n,0)/pieces.length:null,orderCount:documents.size};
}
export function salesAnalytics(data:CrmData,example:boolean,now=new Date()){
 const orders=relevantOrders(data.orders,example).filter(o=>o.order_date<=dayKey(now));const stats=data.customers.map(c=>({customer:c,...customerStats(c,orders,example,now)}));
 const current=dayKey(now).slice(0,7);const monthly=orders.filter(o=>o.order_date.startsWith(current));const measured=monthly.filter(o=>o.quantity_kg!=null);const priced=monthly.filter(o=>o.quantity_kg!=null&&o.amount!=null&&Number(o.quantity_kg)>0);
 const months=[...new Set(orders.map(o=>o.order_date.slice(0,7)))];const monthlyVolume=orders.filter(o=>o.quantity_kg!=null).reduce((s,o)=>s+Number(o.quantity_kg),0)/(months.length||1)/1000;
 const daily=Array.from({length:30},(_,i)=>{const d=new Date(Date.parse(dayKey(now))- (29-i)*86400000).toISOString().slice(0,10);const selected=orders.filter(o=>o.order_date===d);return {date:d,label:d.slice(8)+'/'+d.slice(5,7),orders:new Set(selected.map(o=>o.document_id||o.id)).size};});const mean=daily.reduce((s,d)=>s+d.orders,0)/30;
 const top=data.customers.map(c=>{const rows=orders.filter(o=>o.customer_id===c.id);return {name:c.company,volume:rows.some(o=>o.quantity_kg!=null)?rows.reduce((s,o)=>s+Number(o.quantity_kg||0),0):null,value:rows.some(o=>o.amount!=null)?rows.reduce((s,o)=>s+Number(o.amount||0),0):null};}).filter(c=>c.volume!=null||c.value!=null);
 const segments=[...new Set(data.customers.map(c=>segmentName(c.segment)))].map(name=>({name,value:orders.filter(o=>segmentName(data.customers.find(c=>c.id===o.customer_id)?.segment||'')===name).reduce((s,o)=>s+Number(o.amount||0),0)})).filter(s=>s.value>0);
 const retention=months.sort().slice(-6).map((month,i,arr)=>{const prev=arr[i-1];if(!prev)return null;const before=new Set(orders.filter(o=>o.order_date.startsWith(prev)).map(o=>o.customer_id));const after=new Set(orders.filter(o=>o.order_date.startsWith(month)).map(o=>o.customer_id));const kept=[...before].filter(id=>after.has(id)).length;return {month,retention:before.size?100*kept/before.size:null,churn:before.size?100*(before.size-kept)/before.size:null};}).filter((r):r is NonNullable<typeof r>=>r!=null&&r.retention!=null);
 return {stats,active:data.leads.filter(l=>l.stage==='active').length,risk:stats.filter(s=>s.risk).length,monthlyVolume:orders.some(o=>o.quantity_kg!=null)?monthlyVolume:null,price:priced.length?priced.reduce((s,o)=>s+Number(o.amount),0)/priced.reduce((s,o)=>s+Number(o.quantity_kg),0):null,daily:daily.map(d=>({...d,mean})),top,segments,retention,hasOrders:orders.length>0,measuredCount:measured.length};
}
export function recommendClients(data:CrmData,sku:string,example:boolean){const scores=new Map<string,number>();for(const o of relevantOrders(data.orders,example)){if(!sku.trim()||!o.sku.toLocaleLowerCase('ro').includes(sku.toLocaleLowerCase('ro')))continue;scores.set(o.customer_id,(scores.get(o.customer_id)||0)+Number(o.quantity_kg??o.quantity));}return data.customers.filter(c=>scores.has(c.id)).sort((a,b)=>(scores.get(b.id)||0)-(scores.get(a.id)||0));}
