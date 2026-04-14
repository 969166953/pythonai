interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary:
    'bg-accent text-white hover:bg-accent-hover shadow-sm active:scale-[0.97]',
  secondary:
    'bg-surface-elevated text-text-primary border border-border hover:border-border hover:bg-surface-secondary active:scale-[0.97]',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-surface-secondary',
  danger:
    'bg-danger/10 text-danger hover:bg-danger/20 active:scale-[0.97]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-[13px] rounded-[var(--radius-sm)]',
  md: 'px-4 py-2 text-[14px] rounded-[var(--radius-md)]',
  lg: 'px-6 py-3 text-[15px] rounded-[var(--radius-md)]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all duration-[var(--duration-fast)] cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
