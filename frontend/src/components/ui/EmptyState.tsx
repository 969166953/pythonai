import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-surface-secondary flex items-center justify-center text-text-tertiary mb-4">
        {icon}
      </div>
      <h3 className="text-[17px] font-semibold text-text-primary mb-1">
        {title}
      </h3>
      <p className="text-[14px] text-text-tertiary mb-6 max-w-[280px] text-center">
        {description}
      </p>
      {action}
    </div>
  );
}
