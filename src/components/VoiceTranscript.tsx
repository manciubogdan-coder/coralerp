
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Mic } from "lucide-react";

interface VoiceTranscriptProps {
  transcript: string;
  isRecording: boolean;
}

const VoiceTranscript = ({ transcript, isRecording }: VoiceTranscriptProps) => {
  if (!isRecording || !transcript) return null;
  
  return (
    <Card className="mt-2 bg-gray-50 border-blue-200">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div className="mt-1 bg-blue-100 rounded-full p-1">
            <Mic className="h-3 w-3 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm italic text-gray-700">{transcript}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceTranscript;
