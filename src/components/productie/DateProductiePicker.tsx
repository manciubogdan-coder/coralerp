import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateProductiePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
}

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayISO = () => fmt(new Date());
export const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return fmt(d);
};

const DateProductiePicker = ({ value, onChange, label = "Pentru ziua" }: DateProductiePickerProps) => {
  const today = todayISO();
  const tomorrow = tomorrowISO();

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={value === today ? "default" : "outline"}
          onClick={() => onChange(today)}
        >
          Azi
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === tomorrow ? "default" : "outline"}
          onClick={() => onChange(tomorrow)}
        >
          Mâine
        </Button>
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-auto"
        />
      </div>
    </div>
  );
};

export default DateProductiePicker;
