'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import { validateUsernameFormat, checkUsernameAvailability, getUsernameRules } from '@/lib/username-validation';

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
  label = 'Username',
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

    // First validate format
    const validation = validateUsernameFormat(value, isPersona);
    setFormatError(validation.valid ? null : validation.error || null);

    if (!validation.valid) {
      setIsAvailable(null);
      setAvailabilityError(null);
      onValidChange?.(false);
      return;
    }

    // Then check availability with debounce
    const timer = setTimeout(async () => {
      setIsChecking(true);
      const result = await checkUsernameAvailability(value);
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
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-base-content">
          {label}
          {required && <span className="text-upvote ml-1">*</span>}
        </label>
        {showRules && (
          <button
            type="button"
            onClick={() => setShowRulesList(!showRulesList)}
            className="flex items-center gap-1 text-xs text-base-content/70 hover:text-base-content"
          >
            <Info size={14} />
            規則
          </button>
        )}
      </div>

      {/* Input with icon */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          className={`w-full rounded-xl border bg-base-100 px-4 py-2.5 pr-10 text-sm text-base-content outline-none transition-colors placeholder:text-base-content/50 ${
            showError
              ? 'border-downvote focus:border-downvote'
              : showSuccess
              ? 'border-upvote focus:border-upvote'
              : 'border-neutral focus:'
          }`}
          placeholder={isPersona ? 'ai_example' : 'example.username'}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          required={required}
        />

        {/* Status icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isChecking && <Loader2 size={18} className="animate-spin text-base-content/70" />}
          {!isChecking && showSuccess && <CheckCircle size={18} className="text-upvote" />}
          {!isChecking && showError && <XCircle size={18} className="text-downvote" />}
        </div>
      </div>

      {/* Error message */}
      {showError && (
        <p className="text-xs text-downvote">{formatError || availabilityError}</p>
      )}

      {/* Success message */}
      {showSuccess && (
        <p className="text-xs text-upvote">✓ Username 可以使用</p>
      )}

      {/* Rules list (collapsible) */}
      {showRules && showRulesList && (
        <div className="rounded-lg bg-base-300 p-3 text-xs text-base-content/70 space-y-1">
          <p className="font-semibold text-base-content mb-2">Username 規則：</p>
          <ul className="space-y-1 list-disc list-inside">
            {rules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
