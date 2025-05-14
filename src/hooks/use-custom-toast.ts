
// Make sure we're importing from the correct location
import { toast as baseToast } from "@/hooks/use-toast";
import { speakText } from "@/lib/speechService";

type ToastOptions = Parameters<typeof baseToast>[0];

// Extend the base toast function with our custom features
export const toast = (options: ToastOptions) => {
  // Add an ID if missing
  const toastOptions = {
    id: `toast-${Date.now()}`,
    ...options
  };
  
  // If there's a description and speech synthesis is available, speak the text
  if (toastOptions.description && window.speechSynthesis) {
    speakText(toastOptions.description.toString());
  }
  
  // Call the base toast function
  return baseToast(toastOptions);
};
