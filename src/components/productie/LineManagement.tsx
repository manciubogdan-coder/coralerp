
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useProductionLines, useUpdateLine, useCreateLine, useDeleteLine } from "@/hooks/useProductionData";
import { Loader2, Settings, Edit, Plus, Trash2 } from "lucide-react";

const LineManagement = () => {
  const [editingLine, setEditingLine] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [lineName, setLineName] = useState("");
  const [lineCapacity, setLineCapacity] = useState("");
  const [lineStatus, setLineStatus] = useState<'activa' | 'inactiva' | 'mentenanta'>('activa');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: lines, isLoading } = useProductionLines();
  const updateLine = useUpdateLine();
  const createLine = useCreateLine();
  const deleteLine = useDeleteLine();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'activa': return 'bg-green-500';
      case 'inactiva': return 'bg-yellow-500';
      case 'mentenanta': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'activa': return 'Activă';
      case 'inactiva': return 'Inactivă';
      case 'mentenanta': return 'Mentenanță';
      default: return 'Necunoscut';
    }
  };

  const handleEditLine = (line: any) => {
    setEditingLine(line);
    setLineName(line.nume);
    setLineCapacity(line.capacitate_ora.toString());
    setLineStatus(line.status as 'activa' | 'inactiva' | 'mentenanta');
    setIsEditDialogOpen(true);
  };

  const handleCreateLine = () => {
    setIsCreating(true);
    setLineName("");
    setLineCapacity("");
    setLineStatus('activa');
    setIsCreateDialogOpen(true);
  };

  const handleSaveLine = async () => {
    if (!editingLine || !lineName || !lineCapacity) {
      toast({
        title: "Eroare",
        description: "Completați toate câmpurile obligatorii",
        variant: "destructive"
      });
      return;
    }

    try {
      await updateLine.mutateAsync({
        id: editingLine.id,
        updates: {
          nume: lineName,
          capacitate_ora: parseInt(lineCapacity),
          status: lineStatus
        }
      });

      setIsEditDialogOpen(false);
      setEditingLine(null);
      
      toast({
        title: "Succes",
        description: "Linia a fost actualizată cu succes",
      });
    } catch (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza linia",
        variant: "destructive"
      });
    }
  };

  const handleCreateNew = async () => {
    if (!lineName || !lineCapacity) {
      toast({
        title: "Eroare",
        description: "Completați toate câmpurile obligatorii",
        variant: "destructive"
      });
      return;
    }

    try {
      await createLine.mutateAsync({
        nume: lineName,
        capacitate_ora: parseInt(lineCapacity),
        status: lineStatus
      });

      setIsCreateDialogOpen(false);
      setIsCreating(false);
      setLineName("");
      setLineCapacity("");
      setLineStatus('activa');
      
      toast({
        title: "Succes",
        description: "Linia a fost creată cu succes",
      });
    } catch (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut crea linia",
        variant: "destructive"
      });
    }
  };

  const handleDeleteLine = async (lineId: string, lineName: string) => {
    if (!confirm(`Sunteți sigur că doriți să ștergeți linia "${lineName}"?`)) {
      return;
    }

    try {
      await deleteLine.mutateAsync(lineId);
      toast({
        title: "Succes",
        description: "Linia a fost ștearsă cu succes",
      });
    } catch (error) {
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge linia",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Management Linii de Producție
            </CardTitle>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleCreateLine} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Adaugă Linie
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adaugă Linie Nouă</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nume Linie</Label>
                    <Input
                      placeholder="ex: Linia 1"
                      value={lineName}
                      onChange={(e) => setLineName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Capacitate (buc/oră)</Label>
                    <Input
                      type="number"
                      placeholder="ex: 100"
                      value={lineCapacity}
                      onChange={(e) => setLineCapacity(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Status Linie</Label>
                    <Select value={lineStatus} onValueChange={(value: 'activa' | 'inactiva' | 'mentenanta') => setLineStatus(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selectați statusul..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activa">Activă</SelectItem>
                        <SelectItem value="inactiva">Inactivă</SelectItem>
                        <SelectItem value="mentenanta">Mentenanță</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={handleCreateNew}
                    className="w-full"
                    disabled={createLine.isPending}
                  >
                    {createLine.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Se creează...
                      </>
                    ) : (
                      'Creează Linia'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lines?.map((line) => (
              <Card key={line.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-2 ${getStatusColor(line.status)}`} />
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{line.nume}</CardTitle>
                    <Badge 
                      variant="secondary" 
                      className={`${getStatusColor(line.status)} text-white`}
                    >
                      {getStatusText(line.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Capacitate:</span>
                    <span className="font-medium">{line.capacitate_ora} buc/oră</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span>ID Linie:</span>
                    <span className="font-mono text-xs">{line.id}</span>
                  </div>
                  
                  <div className="flex gap-2 mt-3">
                    <Dialog open={isEditDialogOpen && editingLine?.id === line.id} onOpenChange={(open) => {
                      setIsEditDialogOpen(open);
                      if (!open) setEditingLine(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleEditLine(line)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editează
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editare Linie: {line.nume}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Nume Linie</Label>
                            <Input
                              placeholder="ex: Linia 1"
                              value={lineName}
                              onChange={(e) => setLineName(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Capacitate (buc/oră)</Label>
                            <Input
                              type="number"
                              placeholder="ex: 100"
                              value={lineCapacity}
                              onChange={(e) => setLineCapacity(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Status Linie</Label>
                            <Select value={lineStatus} onValueChange={(value: 'activa' | 'inactiva' | 'mentenanta') => setLineStatus(value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selectați statusul..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="activa">Activă</SelectItem>
                                <SelectItem value="inactiva">Inactivă</SelectItem>
                                <SelectItem value="mentenanta">Mentenanță</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Button 
                            onClick={handleSaveLine}
                            className="w-full"
                            disabled={updateLine.isPending}
                          >
                            {updateLine.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Se salvează...
                              </>
                            ) : (
                              'Salvează Modificările'
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteLine(line.id, line.nume)}
                      disabled={deleteLine.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LineManagement;
