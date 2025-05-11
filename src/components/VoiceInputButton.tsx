
import React from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VoiceInputButtonProps {
  isRecording: boolean;
  toggleRecording: () => void;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

const VoiceInputButton = ({
  isRecording,
  toggleRecording,
  className,
  variant = "outline"
}: VoiceInputButtonProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggleRecording}
            variant={isRecording ? "destructive" : variant}
            size="icon"
            className={cn(
              "rounded-full",
              isRecording && "animate-pulse",
              className
            )}
          >
            {isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isRecording ? "Oprește înregistrarea" : "Pornește înregistrarea vocală"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VoiceInputButton;
