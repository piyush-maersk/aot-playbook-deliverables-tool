import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "on-hero";

export function Button({ variant = "primary", size, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "lg" }) {
  const v = variant === "primary" ? "" : variant;
  return <button type="button" className={`btn ${v} ${size ?? ""} ${className}`.trim()} {...rest} />;
}

export function Card({ children, className = "", onClick, title, actions }: { children?: ReactNode; className?: string; onClick?: () => void; title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`card ${onClick ? "clickable" : ""} ${className}`} onClick={onClick}>
      {(title || actions) && (
        <div className="card-header">
          {typeof title === "string" ? <h3>{title}</h3> : title}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "green" | "amber" | "red" | "grey" | "navy" }) {
  return <span className={`badge ${tone ?? ""}`}>{children}</span>;
}

export function ProgressBar({ value, label, size }: { value: number; label?: ReactNode; size?: "sm" }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      {label !== undefined && (
        <div className="progress-label">
          <span>{label}</span>
          <span>{Math.round(v)}%</span>
        </div>
      )}
      <div className={`progress ${size ?? ""}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 64, stroke = 7, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(v)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--blue-100)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--blue)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y={label ? "46%" : "50%"} dominantBaseline="middle" textAnchor="middle" fontWeight={700} fontSize={size / 4.4} fill="var(--navy)">
        {Math.round(v)}%
      </text>
      {label && (
        <text x="50%" y="68%" dominantBaseline="middle" textAnchor="middle" fontSize={size / 8} fill="var(--muted)">{label}</text>
      )}
    </svg>
  );
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <div className={`field ${className ?? ""}`}>
      <label>{label}</label>
      {children}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function TextInput({ value, onChange, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void }) {
  return <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function TextArea({ value, onChange, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void }) {
  return <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function Select<T extends string>({ value, onChange, options, ...rest }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} {...rest}>
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={wide ? { width: "min(1100px, 100%)" } : undefined}>
        <header>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="modal-backdrop" style={{ background: "rgba(0,36,61,0.15)" }} onClick={onClose} />
      <aside className="drawer">
        <header>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </header>
        <div className="body">{children}</div>
      </aside>
    </>
  );
}

export const Spinner = () => <div className="spinner" aria-label="Loading" />;

export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="center">
      <div className="stack" style={{ alignItems: "center" }}>
        <Spinner />
        <span className="muted">{text}</span>
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export const initials = (name: string) =>
  name.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export const fmtDateTime = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");
