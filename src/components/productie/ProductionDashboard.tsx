
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Line {
  id: number;
  name: string;
  capacity: number;
  activeOrders: number;
  status: string;
}

interface Order {
  id: number;
  store: string;
  product: string;
  quantity: number;
  status: string;
  lineId: number | null;
}

interface ProductionDashboardProps {
  lines: Line[];
  orders: Order[];
}

const ProductionDashboard = ({ lines, orders }: ProductionDashboardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'maintenance': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activă';
      case 'idle': return 'Inactivă';
      case 'maintenance': return 'Mentenanță';
      default: return 'Necunoscut';
    }
  };

  const getTotalOrders = () => orders.length;
  const getActiveLines = () => lines.filter(line => line.status === 'active').length;
  const getIdleLines = () => lines.filter(line => line.status === 'idle').length;
  const getMaintenanceLines = () => lines.filter(line => line.status === 'maintenance').length;

  const idleLines = lines.filter(line => line.status === 'idle');

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Comenzi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{getTotalOrders()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Linii Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{getActiveLines()}/7</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Linii Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{getIdleLines()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">În Mentenanță</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{getMaintenanceLines()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts for idle lines */}
      {idleLines.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertDescription className="text-yellow-800">
            ⚠️ Atenție: {idleLines.length} {idleLines.length === 1 ? 'linie este inactivă' : 'linii sunt inactive'}: {idleLines.map(line => line.name).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {/* Production Lines Map */}
      <Card>
        <CardHeader>
          <CardTitle>Harta Liniilor de Producție</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {lines.map((line) => {
              const lineOrders = orders.filter(order => order.lineId === line.id);
              const completionRate = (line.activeOrders / (line.capacity / 10)) * 100;
              
              return (
                <Card key={line.id} className="relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-full h-1 ${getStatusColor(line.status)}`} />
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">{line.name}</CardTitle>
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
                      <span className="font-medium">{line.capacity} buc/oră</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span>Comenzi active:</span>
                      <span className="font-medium">{line.activeOrders}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Încărcare</span>
                        <span>{Math.round(completionRate)}%</span>
                      </div>
                      <Progress value={completionRate} className="h-2" />
                    </div>
                    
                    {lineOrders.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Comenzi în lucru:</div>
                        {lineOrders.slice(0, 2).map((order) => (
                          <div key={order.id} className="text-xs p-2 bg-gray-50 rounded">
                            {order.product} - {order.quantity} buc
                          </div>
                        ))}
                        {lineOrders.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{lineOrders.length - 2} mai multe
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionDashboard;
