export { CRM_STAGES, isInactive, alertVisible } from '../../../supabase/functions/_shared/crmRules';
export type Stage='lead'|'discovery'|'samples'|'negotiation'|'active';
export const stages: {id:Stage;label:string}[]=[{id:'lead',label:'Lead'},{id:'discovery',label:'Discovery'},{id:'samples',label:'Mostre trimise'},{id:'negotiation',label:'Negociere'},{id:'active',label:'Client activ'}];
export interface Customer {id:string;name:string;company:string;role:string;phone:string;email:string;delivery_locations:string[];senior_erp_id:string;segment:string;order_frequency_days:number;last_order_at:string|null;created_at:string}
export interface Lead {id:string;customer_id:string;stage:Stage;value:number;next_action:string;next_action_date:string|null}
export interface Interaction {id:string;customer_id:string;kind:string;subject:string;body:string;rating:number|null;batch:string;quality_issue:boolean;qa_notified:boolean;created_at:string}
export interface Order {id:string;customer_id:string;order_date:string;sku:string;quantity:number;status:string;source:string}
export interface Alert {id:string;customer_id:string;kind:string;title:string;body:string;status:string;snoozed_until:string|null;created_at:string}
export interface CrmData {customers:Customer[];leads:Lead[];interactions:Interaction[];orders:Order[];alerts:Alert[]}
export const emptyData:CrmData={customers:[],leads:[],interactions:[],orders:[],alerts:[]};
export const money=(n:number)=>new Intl.NumberFormat('ro-RO',{style:'currency',currency:'RON',maximumFractionDigits:0}).format(n);
export const date=(s:string)=>new Date(s).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'});
export const initials=(s:string)=>s.split(' ').filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase();
