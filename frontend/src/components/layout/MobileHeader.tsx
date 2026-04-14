import { Menu, BookOpen } from 'lucide-react';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="glass sticky top-0 z-30 px-4 py-3 flex items-center gap-3 md:hidden">
      <button
        onClick={onMenuClick}
        className="p-2 -ml-1 rounded-[var(--radius-sm)] hover:bg-surface-secondary transition-colors"
      >
        <Menu size={20} className="text-text-primary" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-[6px] bg-accent flex items-center justify-center">
          <BookOpen size={12} className="text-white" />
        </div>
        <span className="text-[14px] font-semibold">AI 知识库</span>
      </div>
    </header>
  );
}
