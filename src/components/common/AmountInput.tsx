import { forwardRef } from 'react';

interface AmountInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  allowDecimal?: boolean;
  autoComplete?: string;
}

function sanitizeAmountInput(rawValue: string, allowDecimal: boolean): string {
  const withoutSeparators = rawValue.replace(/[,\s]/g, '');
  if (!allowDecimal) {
    return withoutSeparators.replace(/\D/g, '');
  }

  const digitsAndDotOnly = withoutSeparators.replace(/[^0-9.]/g, '');
  const [integerPart = '', ...fractionParts] = digitsAndDotOnly.split('.');
  if (!fractionParts.length) {
    return integerPart;
  }

  return `${integerPart}.${fractionParts.join('')}`;
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  {
    id,
    name,
    value,
    onChange,
    onBlur,
    disabled = false,
    required = false,
    placeholder,
    className,
    allowDecimal = true,
    autoComplete = 'off',
  },
  ref,
) {
  return (
    <input
      ref={ref}
      id={id}
      name={name}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      pattern={allowDecimal ? '[0-9]*[.]?[0-9]*' : '[0-9]*'}
      autoComplete={autoComplete}
      value={value}
      onChange={(event) => {
        onChange(sanitizeAmountInput(event.target.value, allowDecimal));
      }}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      className={className}
    />
  );
});
