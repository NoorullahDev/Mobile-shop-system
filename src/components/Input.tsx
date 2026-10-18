import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, prefix, suffix, mono, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;

  return (
    <div className="ui-field flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#334155",
          }}
        >
          {label}
          {"required" in rest && rest.required ? (
            <span style={{ color: "#DC2626", marginLeft: "2px" }}>*</span>
          ) : null}
        </label>
      )}

      <div className="relative flex items-center">
        {prefix && (
          <span
            className="absolute left-0 flex h-full items-center pl-3 text-[13px] font-medium select-none"
            style={{ color: "#64748B" }}
          >
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`h-10 w-full rounded-lg border bg-white text-[13px] outline-none transition-all placeholder:text-[#94A3B8] ${
            prefix ? "pl-9" : "pl-3"
          } ${suffix ? "pr-9" : "pr-3"} ${
            mono ? "font-mono tracking-wide" : ""
          } ${className ?? ""}`}
          style={{
            borderColor: error ? "#DC2626" : "#D8E0EB",
            color: "#0F172A",
            boxShadow: error
              ? "0 0 0 0px rgba(220,38,38,0)"
              : "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? "#DC2626" : "#1769FF";
            e.currentTarget.style.boxShadow = error
              ? "0 0 0 3px rgba(220,38,38,0.12)"
              : "0 0 0 3px rgba(23,105,255,0.12)";
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "#DC2626" : "#D8E0EB";
            e.currentTarget.style.boxShadow = "none";
            rest.onBlur?.(e);
          }}
          {...rest}
        />
        {suffix && (
          <span
            className="absolute right-3 text-[13px] select-none"
            style={{ color: "#64748B" }}
          >
            {suffix}
          </span>
        )}
      </div>

      {error ? (
        <span className="text-[12px]" style={{ color: "#DC2626" }}>
          {error}
        </span>
      ) : hint ? (
        <span className="text-[12px]" style={{ color: "#64748B" }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
});
