import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MessageSquare, Info, BarChart3, VolumeX, Volume2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChartData } from "@/types";
import { cn } from "@/lib/utils";
import InventoryCharts from "./InventoryCharts";
import { useIsMobile } from "@/hooks/use-mobile";
import TeachAssistant from "./TeachAssistant";

interface VoiceCommandPanelProps {
  isRecording: boolean;
  toggleRecording: () => void;
  transcript: string;
  conversations: {text: string; timestamp: Date}[];
  response: string;
  charts?: ChartData[];
  isAudioEnabled: boolean;
  toggleAudio: () => void;
  conversationsEndRef: React.RefObject<HTMLDivElement>;
}

const VoiceCommandPanel = ({
  isRecording,
  toggleRecording,
  transcript,
  conversations,
  response,
  charts,
  isAudioEnabled,
  toggleAudio,
  conversationsEndRef
}: VoiceCommandPanelProps) => {
  const isMobile = useIsMobile();
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  };

  const hasInsufficientQuantityWarning = (text: string): boolean => {
    return text.toLowerCase().includes('atentie') && 
           text.toLowerCase().includes('cantitate') && 
           text.toLowerCase().includes('disponibil');
  };

  const isEmptyInventoryMessage = (text: string): boolean => {
    return (text.toLowerCase().includes('nu am nici o informatie') ||
            text.toLowerCase().includes('nu am nicio informatie')) &&
           text.toLowerCase().includes('stoc');
  };
  
  const isLearningOpportunity = (text: string): boolean => {
    return text.toLowerCase().includes('nu stiu cum sa') || 
           text.toLowerCase().includes('nu am inteles') ||
           text.toLowerCase().includes('nu pot sa') ||
           text.toLowerCase().includes('nu am acces') ||
           (text.toLowerCase().includes('nu') && text.toLowerCase().includes('informatii')) ||
           text.toLowerCase().includes('nu am fost programat');
  };

  const isStockCommand = (text: string): boolean => {
    return text.toLowerCase().includes('stoc') || 
           text.toLowerCase().includes('inventar') ||
           text.toLowerCase().includes('marfa') ||
           text.toLowerCase().includes('produse') ||
           text.toLowerCase().includes('depozit');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className={isMobile ? "p-3 pb-2" : "pb-2"}>
          <div className="flex justify-between items-center">
            <CardTitle className={isMobile ? "text-base" : ""}>Asistent Vocal</CardTitle>
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleAudio}
                title={isAudioEnabled ? "Dezactiveaza audio" : "Activeaza audio"}
                className="h-7 w-7"
              >
                {isAudioEnabled ? <Volume2 className="h-4 w-4 text-green-500" /> : <VolumeX className="h-4 w-4 text-gray-500" />}
              </Button>
              
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
          </div>
          <CardDescription className={isMobile ? "text-xs" : ""}>
            {isRecording ? 'Te ascult... termină-ți mesajul și aşteaptă 2 secunde' : 'Apasă pe microfon și spune-mi cum te pot ajuta'}
          </CardDescription>
        </CardHeader>
        <CardContent className={isMobile ? "p-3 pt-0" : ""}>
          {isRecording && transcript && (
            <>
              <h4 className="text-sm font-medium mb-1">Se înregistrează:</h4>
              <p className="text-sm italic text-gray-700 p-2 bg-gray-50 rounded">"{transcript}"</p>
            </>
          )}
          
          <div className="mt-3">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium flex items-center">
                <Info className="h-3 w-3 mr-1" />
                Exemple de comenzi:
              </h4>
              <TeachAssistant conversations={conversations} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-gray-50 text-xs">Adaugă 5 kg de roșii</Badge>
              <Badge variant="outline" className="bg-gray-50 text-xs">Adaugă 50kg mentă de la Magnani lot 1505</Badge>
              <Badge variant="outline" className="bg-gray-50 text-xs">Scoate 2 kg de cartofi</Badge>
              <Badge variant="outline" className="bg-gray-50 text-xs">Câte loturi de mentă avem?</Badge>
              <Badge variant="outline" className="bg-gray-50 text-xs">Cât s-a consumat azi?</Badge>
              <Badge variant="outline" className="bg-gray-50 text-xs">Consumul de ieri</Badge>
              {!isMobile && (
                <>
                  <Badge variant="outline" className="bg-gray-50 text-xs font-bold text-green-700">Arată stocul</Badge>
                  <Badge variant="outline" className="bg-gray-50 text-xs">Câte produse avem în total?</Badge>
                  <Badge variant="outline" className="bg-gray-50 text-xs">Ce produse expiră în curând?</Badge>
                  <Badge variant="outline" className="bg-gray-50 text-xs">Arată cantitățile pe furnizori</Badge>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className={isMobile ? "p-3 pb-2" : "pb-2"}>
          <CardTitle className={isMobile ? "text-base" : ""}>Conversatie</CardTitle>
          <CardDescription className={isMobile ? "text-xs" : ""}>Discutia cu asistentul de depozit</CardDescription>
        </CardHeader>
        <ScrollArea className={isMobile ? "h-[300px]" : "h-[400px]"}>
          <CardContent className={isMobile ? "p-3" : ""}>
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
                            <p className={isMobile ? "text-xs" : "text-sm"}>
                              {isStockCommand(conv.text) ? <strong>{conv.text}</strong> : conv.text}
                            </p>
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
                          <div className={cn(
                            "p-2 rounded-lg rounded-tl-none",
                            hasInsufficientQuantityWarning(conv.text) 
                              ? "bg-amber-50 border border-amber-200" 
                              : isEmptyInventoryMessage(conv.text)
                                ? "bg-blue-50 border border-blue-200"
                                : "bg-green-light bg-opacity-10"
                          )}>
                            {hasInsufficientQuantityWarning(conv.text) && (
                              <div className="flex items-center gap-2 mb-2 text-amber-600 pb-2 border-b border-amber-200">
                                <AlertTriangle className="h-4 w-4" />
                                <p className={isMobile ? "text-xs font-medium" : "text-sm font-medium"}>Atentie: Cantitate insuficienta</p>
                              </div>
                            )}
                            <p className={isMobile ? "text-xs" : "text-sm"} dangerouslySetInnerHTML={{ __html: conv.text.replace(/\n/g, '<br/>') }}></p>
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
                        <div className={cn(
                          "p-2 rounded-lg rounded-tl-none",
                          hasInsufficientQuantityWarning(response) 
                            ? "bg-amber-50 border border-amber-200" 
                            : isEmptyInventoryMessage(response)
                              ? "bg-blue-50 border border-blue-200"
                              : "bg-green-light bg-opacity-10"
                        )}>
                          {hasInsufficientQuantityWarning(response) && (
                            <div className="flex items-center gap-2 mb-2 text-amber-600 pb-2 border-b border-amber-200">
                              <AlertTriangle className="h-4 w-4" />
                              <p className={isMobile ? "text-xs font-medium" : "text-sm font-medium"}>Atentie: Cantitate insuficienta</p>
                            </div>
                          )}
                          <p className={isMobile ? "text-xs" : "text-sm"} dangerouslySetInnerHTML={{ __html: response.replace(/\n/g, '<br/>') }}></p>
                          
                          {charts && charts.length > 0 && (
                            <div className="mt-4 border-t pt-3">
                              <div className="flex items-center gap-2 mb-2">
                                <BarChart3 className="h-4 w-4 text-green-800" />
                                <h4 className={isMobile ? "text-xs font-medium" : "text-sm font-medium"}>Grafice si date</h4>
                              </div>
                              <InventoryCharts charts={charts} />
                            </div>
                          )}
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
