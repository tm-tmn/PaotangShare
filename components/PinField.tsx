"use client";
// 6-digit numeric password field (digits only, mobile number pad)
export default function PinField({ id, value, onChange, label, auto = "new-password", placeholder }: {
  id?: string; value: string; onChange: (v: string) => void; label?: string; auto?: string; placeholder?: string;
}) {
  return (
    <input
      id={id}
      className="in"
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete={auto}
      maxLength={6}
      placeholder={placeholder}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}
