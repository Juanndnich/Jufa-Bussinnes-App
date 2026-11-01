import React, { useRef, useId } from 'react';
import {
  parseNumberString,
  formatPreviewNumber,
  formatInputValue,
  NumberFormatOptions,
} from '../utils/numberInputUtils';

export interface NumberInputProps extends NumberFormatOptions {
  label?: string;
  value: number | '' | null | undefined;
  onChange: (value: number | '') => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChange,
  prefix,
  suffix,
  isCurrency = false,
  allowDecimals = false,
  maxDecimals = 2,
  placeholder,
  disabled = false,
  error,
  helperText,
  min,
  max,
  className = '',
  inputClassName = '',
  autoFocus = false,
  required = false,
  name,
  id: customId,
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;
  const inputRef = useRef<HTMLInputElement>(null);

  const formatOptions: NumberFormatOptions = {
    prefix,
    suffix,
    isCurrency,
    allowDecimals,
    maxDecimals,
  };

  // Pratinjau angka berformat secara real-time di atas input rata kanan
  const livePreview = formatPreviewNumber(value, formatOptions);

  // Nilai string yang ditampilkan di dalam input
  const displayValue = formatInputValue(value, formatOptions);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawText = e.target.value;
    const inputEl = inputRef.current;
    const prevCursor = inputEl ? inputEl.selectionStart ?? rawText.length : rawText.length;
    const prevLen = rawText.length;

    const parsed = parseNumberString(rawText, formatOptions);

    if (parsed === '') {
      onChange('');
      return;
    }

    let finalVal = parsed;
    if (min !== undefined && finalVal < min) {
      finalVal = min;
    }
    if (max !== undefined && finalVal > max) {
      finalVal = max;
    }

    onChange(finalVal);

    // Menjaga posisi kursor setelah format ulang
    if (inputEl) {
      requestAnimationFrame(() => {
        const nextLen = inputEl.value.length;
        const diff = nextLen - prevLen;
        const nextPos = Math.max(0, Math.min(nextLen, prevCursor + diff));
        inputEl.setSelectionRange(nextPos, nextPos);
      });
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const parsed = parseNumberString(pastedText, formatOptions);
    if (parsed === '') {
      onChange('');
    } else {
      let finalVal = parsed;
      if (min !== undefined && finalVal < min) finalVal = min;
      if (max !== undefined && finalVal > max) finalVal = max;
      onChange(finalVal);
    }
  };

  const effectivePrefix = prefix || (isCurrency ? 'Rp' : undefined);

  return (
    <div className={`flex flex-col space-y-1.5 ${className}`}>
      {/* Baris Atas: Label di Kiri & Pratinjau Terformat Rata Kanan */}
      {(label || livePreview) && (
        <div className="flex items-center justify-between min-h-[18px]">
          {label ? (
            <label
              htmlFor={inputId}
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 select-none flex items-center gap-1"
            >
              {label}
              {required && <span className="text-rose-500">*</span>}
            </label>
          ) : (
            <div />
          )}

          {/* Pratinjau Real-Time Berformat */}
          {livePreview ? (
            <span
              data-testid="number-input-preview"
              className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 select-all"
            >
              {livePreview}
            </span>
          ) : null}
        </div>
      )}

      {/* Kontainer Input */}
      <div
        className={`relative flex items-center rounded-xl border bg-white dark:bg-zinc-900 transition-colors shadow-sm ${
          error
            ? 'border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20'
            : 'border-zinc-300 dark:border-zinc-700 focus-within:border-emerald-500 dark:focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-zinc-100 dark:bg-zinc-800' : ''}`}
      >
        {/* Prefix Visual */}
        {effectivePrefix && (
          <span className="pl-3.5 pr-1 text-xs font-mono font-semibold text-zinc-400 dark:text-zinc-500 select-none">
            {effectivePrefix}
          </span>
        )}

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          inputMode={allowDecimals ? 'decimal' : 'numeric'}
          value={displayValue}
          onChange={handleInputChange}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          className={`w-full py-2.5 px-3 text-sm font-mono text-zinc-900 dark:text-zinc-100 bg-transparent outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 ${
            effectivePrefix ? 'pl-1.5' : ''
          } ${suffix ? 'pr-1.5' : ''} ${inputClassName}`}
        />

        {/* Suffix Visual */}
        {suffix && (
          <span className="pr-3.5 pl-1 text-xs font-mono font-medium text-zinc-400 dark:text-zinc-500 select-none">
            {suffix}
          </span>
        )}
      </div>

      {/* Pesan Kesalahan / Helper */}
      {error ? (
        <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium pl-0.5">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};
