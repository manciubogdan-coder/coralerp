
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, PieChart, LineChart, Bar, Pie, Line, XAxis, YAxis, Legend, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartData } from "@/types";

interface InventoryChartsProps {
  charts?: ChartData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

const InventoryCharts = ({ charts }: InventoryChartsProps) => {
  if (!charts || charts.length === 0) return null;

  return (
    <div className="space-y-4">
      {charts.map((chart, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader>
            <CardTitle>{chart.title}</CardTitle>
            {chart.description && <p className="text-sm text-gray-500">{chart.description}</p>}
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chart.type === 'bar' && (
                  <BarChart data={chart.data} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                    <XAxis dataKey={chart.xKey || "name"} angle={-45} textAnchor="end" height={50} />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey={chart.yKey || "value"} fill="#0088FE">
                      {chart.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
                {chart.type === 'pie' && (
                  <PieChart>
                    <Pie
                      data={chart.data}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({name, value}) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey={chart.yKey || "value"}
                    >
                      {chart.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                )}
                {chart.type === 'line' && (
                  <LineChart data={chart.data} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                    <XAxis dataKey={chart.xKey || "name"} angle={-45} textAnchor="end" height={50} />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey={chart.yKey || "value"} stroke="#0088FE" />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white p-2 border rounded shadow-md">
      <p className="font-bold">{label}</p>
      {payload.map((item: any, index: number) => (
        <p key={index} style={{ color: item.color }}>
          {`${item.name}: ${item.value}`}
        </p>
      ))}
    </div>
  );
};

export default InventoryCharts;
