"use client";

import { Minus, Plus } from "lucide-react";

type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  label?: string;
};

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  disabled = false,
  label = "Quantidade",
}: QuantityStepperProps) {
  const safeValue = clamp(value, min, max);
  const className = `quantity-stepper quantity-stepper--${size}`;

  return (
    <div className={className} role="group" aria-label={label}>
      <button
        type="button"
        className="quantity-stepper-btn"
        onClick={() => onChange(clamp(safeValue - 1, min, max))}
        disabled={disabled || safeValue <= min}
        aria-label="Diminuir quantidade"
      >
        <Minus size={size === "sm" ? 12 : 14} aria-hidden />
      </button>
      <input
        type="number"
        className="quantity-stepper-input"
        inputMode="numeric"
        min={min}
        max={max}
        value={safeValue}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
        onBlur={(event) => {
          const parsed = Number(event.target.value);
          if (parsed !== safeValue) {
            onChange(clamp(parsed, min, max));
          }
        }}
      />
      <button
        type="button"
        className="quantity-stepper-btn"
        onClick={() => onChange(clamp(safeValue + 1, min, max))}
        disabled={disabled || safeValue >= max}
        aria-label="Aumentar quantidade"
      >
        <Plus size={size === "sm" ? 12 : 14} aria-hidden />
      </button>
    </div>
  );
}
