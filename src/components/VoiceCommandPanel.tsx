
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MessageSquare, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceCommandPanelProps {
  isRecording: boolean;
  toggleRecording: () => void;
  transcript: string;
  conversations: {text: string; timestamp: Date}[];
  response: string;
  conversationsEndRef: React.RefObject<HTMLDivElement>;
}

const VoiceCommandPanel = ({
  isRecording,
  toggleRecording,
  transcript,
  conversations,
  response,
  conversationsEndRef
}: VoiceCommandPanelProps) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle>Asistent Vocal</CardTitle>
            <Button 
              onClick={toggleRecording}
              variant={isRecording ? "destructive" : "outline"}
              size="sm"
              className={cn(
                "rounded-full p-2 h-8 w-8", 
                isRecording && "animate-pulse"
              )}
            >
              <Mic 
                className={`h-4 w-4 ${
                  isRecording ? 'text-white' : 'text-gray-500'
                }`} 
              />
            </Button>
          </div>
          <CardDescription>
            {isRecording ? 'Te ascult... spune-mi cum te pot ajuta' : 'Apasă pe microfon și spune-mi cum te pot ajuta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isRecording && transcript && (
            <>
              <h4 className="text-sm font-medium mb-1">Se înregistrează:</h4>
              <p className="text-sm italic text-gray-700 p-2 bg-gray-50 rounded">"{transcript}"</p>
            </>
          )}
          
          <div className="mt-3">
            <h4 className="text-sm font-medium flex items-center">
              <Info className="h-3 w-3 mr-1" />
              Exemple de comenzi:
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-gray-50">Adaugă 5 kg de roșii</Badge>
              <Badge variant="outline" className="bg-gray-50">Adaugă 50kg mentă de la Magnani lot 1505</Badge>
              <Badge variant="outline" className="bg-gray-50">Scoate 2 kg de cartofi</Badge>
              <Badge variant="outline" className="bg-gray-50">Câte loturi de mentă avem?</Badge>
              <Badge variant="outline" className="bg-gray-50">Scoate 50 kg de mentă de la Magnani lot 1505</Badge>
              <Badge variant="outline" className="bg-gray-50">Arată stocul</Badge>
              <Badge variant="outline" className="bg-gray-50">Exportă Excel</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Conversație</CardTitle>
          <CardDescription>Discuția cu asistentul de depozit</CardDescription>
        </CardHeader>
        <ScrollArea className="h-[400px]">
          <CardContent>
            <div className="space-y-4">
              {conversations.map((conv, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-start gap-2">
                    {index % 2 === 0 ? (
                      <>
                        <div className="bg-gray-100 rounded-full p-1.5 mt-1">
                          <Mic className="h-3 w-3 text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-100 p-2 rounded-lg rounded-tl-none">
                            <p className="text-sm">{conv.text}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-right">
                            {formatTime(conv.timestamp)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-green-light rounded-full p-1.5 mt-1">
                          <MessageSquare className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="bg-green-light bg-opacity-10 p-2 rounded-lg rounded-tl-none">
                            <p className="text-sm" dangerouslySetInnerHTML={{ __html: conv.text.replace(/\n/g, '<br/>') }}></p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-right">
                            {formatTime(conv.timestamp)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {index === conversations.length - 1 && response && (
                    <div className="flex items-start gap-2">
                      <div className="bg-green-light rounded-full p-1.5 mt-1">
                        <MessageSquare className="h-3 w-3 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-green-light bg-opacity-10 p-2 rounded-lg rounded-tl-none">
                          <p className="text-sm" dangerouslySetInnerHTML={{ __html: response.replace(/\n/g, '<br/>') }}></p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 text-right">
                          {formatTime(new Date())}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {index < conversations.length - 1 && <Separator />}
                </div>
              ))}
              <div ref={conversationsEndRef} />
            </div>
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default VoiceCommandPanel;
