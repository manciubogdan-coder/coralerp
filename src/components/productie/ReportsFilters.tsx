
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { Calendar, CalendarRange } from "lucide-react";

interface ReportsFiltersProps {
  onFilterChange: (filter: DateFilter) => void;
  currentFilter: DateFilter;
}

export interface DateFilter {
  type: 'today' | 'week' | 'month' | 'custom';
  dateRange: DateRange | undefined;
  label: string;
}

const ReportsFilters = ({ onFilterChange, currentFilter }: ReportsFiltersProps) => {
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  const today = new Date();
  
  const predefinedFilters: DateFilter[] = [
    {
      type: 'today',
      dateRange: { from: today, to: today },
      label: 'Astăzi'
    },
    {
      type: 'week',
      dateRange: { 
        from: startOfWeek(today, { weekStartsOn: 1 }), 
        to: endOfWeek(today, { weekStartsOn: 1 }) 
      },
      label: 'Săptămâna curentă'
    },
    {
      type: 'month',
      dateRange: { 
        from: startOfMonth(today), 
        to: endOfMonth(today) 
      },
      label: 'Luna curentă'
    }
  ];

  const handlePredefinedFilter = (filter: DateFilter) => {
    onFilterChange(filter);
  };

  const handleCustomFilter = () => {
    if (customDateRange?.from) {
      const customFilter: DateFilter = {
        type: 'custom',
        dateRange: customDateRange,
        label: customDateRange.to 
          ? `${format(customDateRange.from, 'dd/MM/yyyy')} - ${format(customDateRange.to, 'dd/MM/yyyy')}`
          : format(customDateRange.from, 'dd/MM/yyyy')
      };
      onFilterChange(customFilter);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Filtrare Perioada
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Filtre predefinite */}
          <div>
            <div className="text-sm font-medium mb-2">Perioade predefinite:</div>
            <div className="flex flex-wrap gap-2">
              {predefinedFilters.map((filter) => (
                <Button
                  key={filter.type}
                  variant={currentFilter.type === filter.type ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePredefinedFilter(filter)}
                  className="text-xs"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Filtru custom */}
          <div>
            <div className="text-sm font-medium mb-2">Perioada personalizată:</div>
            <div className="flex items-center gap-2">
              <DatePickerWithRange
                date={customDateRange}
                setDate={setCustomDateRange}
                className="w-auto"
              />
              <Button
                onClick={handleCustomFilter}
                disabled={!customDateRange?.from}
                size="sm"
                className="text-xs"
              >
                Aplică
              </Button>
            </div>
          </div>

          {/* Afișare filtru activ */}
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground mb-1">Filtru activ:</div>
            <Badge variant="secondary" className="text-xs">
              <CalendarRange className="h-3 w-3 mr-1" />
              {currentFilter.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportsFilters;
