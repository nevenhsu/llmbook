"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, Info } from "lucide-react";
import {
  validateUsernameFormat,
  checkUsernameAvailability,
  getUsernameRules,
  sanitizeUsername,
} from "@/lib/username-validation";

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  isPersona?: boolean;
  required?: boolean;
  label?: string;
  showRules?: boolean;
  checkAvailability?: boolean;
}

export default function UsernameInput({
  value,
  onChange,
  onValidChange,
  isPersona = false,
  required = true,
  label = "Username",
  showRules = true,
  checkAvailability = true,
}: UsernameInputProps) {
  const [formatError, setFormatError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [showRulesList, setShowRulesList] = useState(false);

  const rules = getUsernameRules(isPersona);

  // Debounced availability check
  useEffect(() => {
    if (!value || !checkAvailability) {
      setIsAvailable(null);
      setAvailabilityError(null);
      return;
    }

    // Validate original input first (don't sanitize yet)
    const validation = validateUsernameFormat(value.trim().toLowerCase(), isPersona);
    setFormatError(validation.valid ? null : validation.error || null);

    if (!validation.valid) {
      setIsAvailable(null);
      setAvailabilityError(null);
      onValidChange?.(false);
      return;
    }

    // Then check availability with debounce (use sanitized value)
    const timer = setTimeout(async () => {
      setIsChecking(true);
      const cleanValue = sanitizeUsername(value);
      const result = await checkUsernameAvailability(cleanValue);
      setIsChecking(false);
      setIsAvailable(result.available);
      setAvailabilityError(result.error || null);
      onValidChange?.(result.available);
    }, 500);

    return () => clearTimeout(timer);
  }, [value, checkAvailability, isPersona, onValidChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert to lowercase automatically
    const newValue = e.target.value.toLowerCase();
    onChange(newValue);
  };

  const isValid = !formatError && (checkAvailability ? isAvailable === true : true);
  const showSuccess = isValid && value.length > 0;
  const showError = formatError || availabilityError;

  return (
    <div className="form-control">
      {/* Label */}
      <label className="label w-full">
        <span className="label-text font-semibold">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </span>
        {showRules && (
          <button
            type="button"
            onClick={() => setShowRulesList(!showRulesList)}
            className="label-text-alt hover:text-base-content ml-auto flex items-center gap-1 text-xs"
          >
            <Info size={12} />
            規則
          </button>
        )}
      </label>

      {/* Input with icon */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          className={`input w-full pr-10 ${
            showError ? "input-error" : showSuccess ? "input-success" : "input-bordered"
          }`}
          placeholder={isPersona ? "ai_example" : "example.username"}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          required={required}
        />

        {/* Status icon */}
        <div className="absolute top-1/2 right-3 -translate-y-1/2">
          {isChecking && <Loader2 size={18} className="animate-spin opacity-70" />}
          {!isChecking && showSuccess && <CheckCircle size={18} className="text-success" />}
          {!isChecking && showError && <XCircle size={18} className="text-error" />}
        </div>
      </div>

      {/* Error message */}
      {showError && (
        <label className="label !whitespace-normal">
          <span className="label-text-alt text-error text-xs break-words">
            {formatError || availabilityError}
          </span>
        </label>
      )}

      {/* Success message */}
      {showSuccess && (
        <label className="label !whitespace-normal">
          <span className="label-text-alt text-success text-xs">✓ Username 可以使用</span>
        </label>
      )}

      {/* Rules list (collapsible) */}
      {showRules && showRulesList && (
        <div className="bg-base-200 mt-2 space-y-1 rounded-lg p-3 text-sm">
          <p className="mb-2 font-semibold">Username 規則：</p>
          <ul className="list-inside list-disc space-y-1 opacity-70">
            {rules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
