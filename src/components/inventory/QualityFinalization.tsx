import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { qualityEmailApi } from '@/lib/qualityEmailApi';

export default function QualityFinalization({inventoryType,ids,revision,save}:{inventoryType:string;ids:string[];revision:string;save:()=>Promise<void>}) {
  const {isAdmin,hasDepartment}=useAuth(); const allowed=isAdmin||hasDepartment('calitate');
  const {toast}=useToast();const [busy,setBusy]=useState(false),[done,setDone]=useState(false);const key=ids.join(',');
  useEffect(()=>{setDone(false);if(!allowed||!ids.length)return;let active=true;
    void (async()=>{const reviews:any[]=[];for(let i=0;i<ids.length;i+=50){const r=await qualityEmailApi({action:'reviews',inventory_type:inventoryType,ids:ids.slice(i,i+50)});reviews.push(...r.reviews);}if(active)setDone(reviews.length===ids.length&&reviews.every(r=>r.finalized));})().catch(()=>{});
    return()=>{active=false;};
  },[inventoryType,key,allowed,revision]);
  if(!allowed||!ids.length)return null;
  return <Button size="sm" variant={done?'secondary':'outline'} disabled={busy} onClick={async()=>{setBusy(true);try{await save();await qualityEmailApi({action:'finalize',inventory_type:inventoryType,ids,finalized:!done});setDone(!done);toast({title:done?'Calitatea a fost redeschisă.':'Calitate finalizată pentru trimitere.'});}catch(e){toast({title:'Finalizarea a eșuat.',description:e instanceof Error?e.message:'Verifică datele.',variant:'destructive'});}finally{setBusy(false);}}}>{busy?<Loader2 className="h-4 w-4 mr-2 animate-spin"/>:<ShieldCheck className="h-4 w-4 mr-2"/>}{done?'Calitate finalizată':'Finalizează calitatea'}</Button>;
}