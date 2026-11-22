import React, { useEffect, useRef, useState } from 'react';

interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (val: number) => void;
  min?: number;
  allowDecimal?: boolean;
  hideZero?: boolean;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onValueChange,
  min = 0,
  allowDecimal = false,
  hideZero = true,
  placeholder = '0',
  onBlur,
  ...rest
}) => {
  const formatNum = (n: number) => (n === 0 && hideZero ? '' : String(n));
  const [raw, setRaw] = useState<string>(() => formatNum(value));
  const lastEmittedRef = useRef<number>(value);

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      setRaw(formatNum(value));
    }
  }, [value, hideZero]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let txt = e.target.value;
    if (allowDecimal) {
      txt = txt.replace(',', '.').replace(/[^0-9.]/g, '');
      const firstDot = txt.indexOf('.');
      if (firstDot !== -1) {
        txt = txt.slice(0, firstDot + 1) + txt.slice(firstDot + 1).replace(/\./g, '');
      }
      txt = txt.replace(/^0+(?=\d)/, '');
    } else {
      txt = txt.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    }

    setRaw(txt);

    if (txt === '' || txt === '.') {
      lastEmittedRef.current = min;
      onValueChange(min);
      return;
    }

    const parsed = Number(txt);
    const clamped = Number.isFinite(parsed) ? Math.max(min, parsed) : min;
    lastEmittedRef.current = clamped;
    onValueChange(clamped);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (raw === '' || raw === '.') {
      const fallback = min > 0 ? min : 0;
      lastEmittedRef.current = fallback;
      onValueChange(fallback);
      setRaw(formatNum(fallback));
    } else {
      const parsed = Math.max(min, Number(raw) || min);
      lastEmittedRef.current = parsed;
      setRaw(formatNum(parsed));
    }
    onBlur?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      placeholder={placeholder}
      value={raw}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};
