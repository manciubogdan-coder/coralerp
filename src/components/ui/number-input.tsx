import * as React from "react";
import { Input } from "@/components/ui/input";

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
  /** Value restored when the field is left empty on blur. */
  fallback?: number;
  integer?: boolean;
  minValue?: number;
};

/**
 * Numeric field that lets the user clear it while typing.
 * The empty draft stays visible; the fallback is applied only on blur.
 */
export const NumberInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, fallback = 1, integer = false, minValue, onBlur, ...rest }, ref) => {
    const [draft, setDraft] = React.useState<string>(String(value ?? ""));

    React.useEffect(() => {
      const parsed = integer ? parseInt(draft) : parseFloat(draft);
      if (parsed !== value) setDraft(String(value ?? ""));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const parse = (text: string) => {
      const n = integer ? parseInt(text) : parseFloat(text.replace(",", "."));
      if (!Number.isFinite(n)) return null;
      return minValue !== undefined ? Math.max(minValue, n) : n;
    };

    return (
      <Input
        ref={ref}
        type="number"
        {...rest}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parse(e.target.value);
          if (n !== null) onValueChange(n);
        }}
        onBlur={(e) => {
          const n = parse(draft);
          if (n === null) {
            setDraft(String(fallback));
            onValueChange(fallback);
          } else {
            setDraft(String(n));
          }
          onBlur?.(e);
        }}
      />
    );
  },
);
NumberInput.displayName = "NumberInput";
