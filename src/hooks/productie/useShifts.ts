
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductieSchimb {
  id: string;
  nume: string;
  ora_start: string;
  ora_sfarsit: string;
  created_at: string;
}

// Hook pentru încărcarea schimburilor
export const useShifts = () => {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      console.log('Fetching shifts from database...');
      const { data, error } = await supabase
        .from('productie_schimburi')
        .select('*')
        .order('ora_start');
      
      if (error) {
        console.error('Error fetching shifts:', error);
        throw error;
      }
      console.log('Shifts fetched:', data);
      return data as ProductieSchimb[];
    }
  });
};

// Funcție pentru calcularea duratei unui schimb în ore
export const calculateShiftDuration = (oraStart: string, oraSfarsit: string): number => {
  // Parseaza corect formatul HH:MM:SS
  const [startHour, startMin] = oraStart.split(':').map(Number);
  const [endHour, endMin] = oraSfarsit.split(':').map(Number);
  
  const start = new Date(2024, 0, 1, startHour, startMin, 0);
  let end = new Date(2024, 0, 1, endHour, endMin, 0);
  
  // Dacă ora de sfârșit este mai mică decât ora de start, înseamnă că se termină a doua zi
  if (end <= start) {
    end = new Date(2024, 0, 2, endHour, endMin, 0);
  }
  
  const diffMs = end.getTime() - start.getTime();
  const hours = diffMs / (1000 * 60 * 60); // convertim în ore
  
  console.log(`Calculating shift duration: ${oraStart} - ${oraSfarsit} = ${hours}h`);
  return Math.round(hours * 10) / 10; // rotunjim la o zecimală
};

// Funcție pentru determinarea schimbului curent bazat pe ora actuală
export const getCurrentShift = (shifts: ProductieSchimb[]): ProductieSchimb | null => {
  const now = new Date();
  const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
  
  console.log('Checking current shift for time:', currentTime);
  
  for (const shift of shifts) {
    const startTime = shift.ora_start.substring(0, 5);
    const endTime = shift.ora_sfarsit.substring(0, 5);
    
    // Verificăm dacă schimbul se întinde peste miezul nopții
    if (startTime > endTime) {
      // Schimb care se întinde peste miezul nopții (ex: 22:00 - 06:00)
      if (currentTime >= startTime || currentTime <= endTime) {
        console.log('Current shift found (overnight):', shift.nume);
        return shift;
      }
    } else {
      // Schimb normal în aceeași zi
      if (currentTime >= startTime && currentTime <= endTime) {
        console.log('Current shift found:', shift.nume);
        return shift;
      }
    }
  }
  
  console.log('No current shift found');
  return null;
};

// Funcție pentru calcularea productivității pe schimb
export const calculateShiftProductivity = (
  cantitateProducta: number, 
  timpLucruMinute: number, 
  durataSchimbOre: number
): { 
  bucatiPeOra: number; 
  bucatiPeSchimb: number; 
  eficientaSchimb: number; 
} => {
  const bucatiPeOra = timpLucruMinute > 0 ? (cantitateProducta / (timpLucruMinute / 60)) : 0;
  const bucatiPeSchimb = bucatiPeOra * durataSchimbOre;
  const eficientaSchimb = timpLucruMinute > 0 ? (timpLucruMinute / 60) / durataSchimbOre * 100 : 0;
  
  return {
    bucatiPeOra: Math.round(bucatiPeOra * 10) / 10,
    bucatiPeSchimb: Math.round(bucatiPeSchimb * 10) / 10,
    eficientaSchimb: Math.round(eficientaSchimb * 10) / 10
  };
};
