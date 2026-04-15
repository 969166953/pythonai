import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认删除',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />
      <div className="relative bg-surface-elevated rounded-[var(--radius-lg)] border border-border-light shadow-lg p-6 w-[380px] max-w-[90vw] animate-slide-up">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-[var(--radius-md)] bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div>
            <h3 className="text-[16px] font-semibold mb-1">{title}</h3>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
