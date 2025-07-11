import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Package, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryType } from "@/App";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface ConsumptionTrend {
  date: string;
  total_consumed: number;
  products_count: number;
}

interface TopProduct {
  name: string;
  total_quantity: number;
  operations_count: number;
}

interface DailyActivity {
  date: string;
  additions: number;
  removals: number;
  net_change: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { inventoryType } = useInventoryType();
  const [consumptionTrends, setConsumptionTrends] = useState<ConsumptionTrend[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, [inventoryType]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Use correct history table based on inventory type
      const historyTable = inventoryType === 'ambalaje' ? 'ambalaje_inventory_history' : 'inventory_history';

      // Fetch consumption trends (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: trendsData } = await supabase
        .from(historyTable)
        .select('operation_date, quantity, net_quantity, name')
        .eq('action', 'remove')
        .gte('operation_date', thirtyDaysAgo.toISOString())
        .order('operation_date');

      // Group by date for trends
      const trendsMap = new Map<string, { total: number; products: Set<string> }>();
      trendsData?.forEach(item => {
        const date = item.operation_date.split('T')[0];
        const quantity = item.net_quantity || item.quantity;
        
        if (!trendsMap.has(date)) {
          trendsMap.set(date, { total: 0, products: new Set() });
        }
        
        const dayData = trendsMap.get(date)!;
        dayData.total += quantity;
        dayData.products.add(item.name);
      });

      const trends = Array.from(trendsMap.entries()).map(([date, data]) => ({
        date,
        total_consumed: Number(data.total.toFixed(2)),
        products_count: data.products.size
      })).sort((a, b) => a.date.localeCompare(b.date));

      setConsumptionTrends(trends);

      // Fetch top consumed products (last 30 days)
      const { data: topProductsData } = await supabase
        .from(historyTable)
        .select('name, quantity, net_quantity')
        .eq('action', 'remove')
        .gte('operation_date', thirtyDaysAgo.toISOString());

      const productMap = new Map<string, { total: number; count: number }>();
      topProductsData?.forEach(item => {
        const quantity = item.net_quantity || item.quantity;
        
        if (!productMap.has(item.name)) {
          productMap.set(item.name, { total: 0, count: 0 });
        }
        
        const productData = productMap.get(item.name)!;
        productData.total += quantity;
        productData.count += 1;
      });

      const topProductsList = Array.from(productMap.entries())
        .map(([name, data]) => ({
          name,
          total_quantity: Number(data.total.toFixed(2)),
          operations_count: data.count
        }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 10);

      setTopProducts(topProductsList);

      // Fetch daily activity (last 14 days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      
      const { data: activityData } = await supabase
        .from(historyTable)
        .select('operation_date, action, quantity, net_quantity')
        .gte('operation_date', fourteenDaysAgo.toISOString());

      const activityMap = new Map<string, { additions: number; removals: number }>();
      activityData?.forEach(item => {
        const date = item.operation_date.split('T')[0];
        const quantity = item.net_quantity || item.quantity;
        
        if (!activityMap.has(date)) {
          activityMap.set(date, { additions: 0, removals: 0 });
        }
        
        const dayActivity = activityMap.get(date)!;
        if (item.action === 'add') {
          dayActivity.additions += quantity;
        } else if (item.action === 'remove') {
          dayActivity.removals += quantity;
        }
      });

      const activity = Array.from(activityMap.entries()).map(([date, data]) => ({
        date,
        additions: Number(data.additions.toFixed(2)),
        removals: Number(data.removals.toFixed(2)),
        net_change: Number((data.additions - data.removals).toFixed(2))
      })).sort((a, b) => a.date.localeCompare(b.date));

      setDailyActivity(activity);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header />
        <main className="flex-1 container mx-auto p-6">
          <div className="text-center py-8">Se încarcă datele analytics...</div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Înapoi la panou
            </Button>
            <h1 className="text-2xl font-bold">Analytics Stoc</h1>
          </div>
        </div>

        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList>
            <TabsTrigger value="trends">Tendințe Consum</TabsTrigger>
            <TabsTrigger value="products">Top Produse</TabsTrigger>
            <TabsTrigger value="activity">Activitate Zilnică</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Consum (30 zile)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {consumptionTrends.reduce((sum, day) => sum + day.total_consumed, 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">kg consumate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Medie Zilnică</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {consumptionTrends.length > 0 
                      ? (consumptionTrends.reduce((sum, day) => sum + day.total_consumed, 0) / consumptionTrends.length).toFixed(2)
                      : '0'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">kg/zi</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Produse Active</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{topProducts.length}</div>
                  <p className="text-xs text-muted-foreground">cu activitate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Operații Totale</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {topProducts.reduce((sum, product) => sum + product.operations_count, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">ultimele 30 zile</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tendința Consumului (Ultimele 30 de zile)</CardTitle>
                <CardDescription>Evoluția zilnică a consumului de produse</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={consumptionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="total_consumed" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Cantitate Consumată (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top 10 Produse Consumate</CardTitle>
                  <CardDescription>Cele mai folosite produse în ultimele 30 de zile</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end" 
                        height={100}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar 
                        dataKey="total_quantity" 
                        fill="#8884d8"
                        name="Cantitate Totală (kg)"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Distribuția Consumului</CardTitle>
                  <CardDescription>Top 5 produse după cantitate</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                      <Pie
                        data={topProducts.slice(0, 5)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}kg`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="total_quantity"
                      >
                        {topProducts.slice(0, 5).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activitate Zilnică Stoc</CardTitle>
                <CardDescription>Intrări și ieșiri din stoc pe ultimele 14 zile</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={dailyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="additions" fill="#00C49F" name="Intrări (kg)" />
                    <Bar dataKey="removals" fill="#FF8042" name="Ieșiri (kg)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schimbarea Netă a Stocului</CardTitle>
                <CardDescription>Diferența între intrări și ieșiri</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="net_change" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Schimbare Netă (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default AnalyticsPage;