import { Input } from "@/components/ui/input";
import { forwardRef, useState, useEffect, useRef } from "react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number; // Value in cents
  onChange?: (cents: number) => void;
}

/**
 * CurrencyInput - Real-time currency formatting component
 * 
 * Features:
 * - Formats as user types: "2950" → "$2,950.00"
 * - Accepts both "2950" and "2950.00" formats
 * - Stores numeric value in cents internally
 * - Displays formatted USD currency
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value = 0, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const isUserTyping = useRef(false);

    // Convert cents to formatted display string
    const formatCurrency = (cents: number): string => {
      const dollars = cents / 100;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(dollars);
    };

    // Parse user input (in dollars) to cents
    const parseToCents = (input: string): number => {
      // Remove all non-numeric characters except decimal point
      const cleaned = input.replace(/[^0-9.]/g, '');
      
      if (!cleaned || cleaned === '.') return 0;
      
      // Parse as dollars
      const dollars = parseFloat(cleaned);
      
      // Convert to cents
      return Math.round(dollars * 100);
    };

    // Update display when value prop changes from outside (not during user typing)
    useEffect(() => {
      if (!isUserTyping.current && !isFocused) {
        setDisplayValue(formatCurrency(value));
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      isUserTyping.current = true;

      // Allow empty input
      if (input === '' || input === '$') {
        setDisplayValue('');
        onChange?.(0);
        return;
      }

      // Update display immediately (show what user is typing)
      setDisplayValue(input);

      // Parse to cents and notify parent
      const cents = parseToCents(input);
      onChange?.(cents);
    };

    const handleFocus = () => {
      setIsFocused(true);
      // Show raw number for easier editing (without $ and commas)
      const dollars = value / 100;
      setDisplayValue(dollars === 0 ? '' : dollars.toFixed(2));
    };

    const handleBlur = () => {
      setIsFocused(false);
      isUserTyping.current = false;
      
      // Format on blur
      setDisplayValue(formatCurrency(value));
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="$0.00"
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
