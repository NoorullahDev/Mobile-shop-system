import { SelectHTMLAttributes, forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, options, placeholder, className, id, ...rest },
  ref,
) {
  const selectId = id ?? rest.name;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={selectId}
          style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}
        >
          {label}
          {"required" in rest && rest.required ? (
            <span style={{ color: "#DC2626", marginLeft: "2px" }}>*</span>
          ) : null}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`h-9 w-full rounded border bg-white px-3 text-[14px] outline-none transition-all ${className ?? ""}`}
        style={{
          borderColor: error ? "#DC2626" : "#CBD5E1",
          color: "#0F172A",
          appearance: "auto",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? "#DC2626" : "#3B6FD4";
          e.currentTarget.style.boxShadow = error
            ? "0 0 0 3px rgba(220,38,38,0.12)"
            : "0 0 0 3px rgba(59,111,212,0.12)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "#DC2626" : "#CBD5E1";
          e.currentTarget.style.boxShadow = "none";
        }}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <span style={{ fontSize: "12px", color: "#DC2626" }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: "12px", color: "#64748B" }}>{hint}</span>
      ) : null}
    </div>
  );
});
