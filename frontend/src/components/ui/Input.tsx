interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[13px] font-medium text-text-secondary">
          {label}
        </span>
      )}
      <input
        className={`
          w-full px-3.5 py-2.5 text-[14px] rounded-[var(--radius-md)]
          bg-surface-elevated border border-border
          text-text-primary placeholder:text-text-tertiary
          outline-none transition-all duration-[var(--duration-fast)]
          focus:border-accent focus:ring-2 focus:ring-accent/15
          ${className}
        `}
        {...props}
      />
    </label>
  );
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[13px] font-medium text-text-secondary">
          {label}
        </span>
      )}
      <textarea
        className={`
          w-full px-3.5 py-2.5 text-[14px] rounded-[var(--radius-md)]
          bg-surface-elevated border border-border
          text-text-primary placeholder:text-text-tertiary
          outline-none transition-all duration-[var(--duration-fast)]
          focus:border-accent focus:ring-2 focus:ring-accent/15
          resize-none
          ${className}
        `}
        {...props}
      />
    </label>
  );
}
