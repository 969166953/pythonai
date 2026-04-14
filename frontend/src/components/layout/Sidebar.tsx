import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, BookOpen, MessageSquare, Trash2, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import type { KnowledgeBase } from '../../lib/api';
import { Button } from '../ui/Button';
import { SidebarSkeleton } from '../ui/Skeleton';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const { kbId } = useParams();
  const navigate = useNavigate();

  const loadKnowledgeBases = async () => {
    setLoading(true);
    const res = await api.knowledgeBases.list();
    if (res.success && res.data) {
      setKnowledgeBases(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await api.knowledgeBases.create(newName.trim(), '');
    if (res.success && res.data) {
      setKnowledgeBases((prev) => [...prev, res.data!]);
      setNewName('');
      setCreating(false);
      navigate(`/kb/${res.data.id}`);
      onNavigate?.();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = await api.knowledgeBases.delete(id);
    if (res.success) {
      setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
      if (kbId === id) navigate('/');
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <aside className="w-[260px] h-screen flex flex-col border-r border-border-light bg-surface-secondary/50">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-accent flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">
            AI 知识库
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} />
          新建知识库
        </Button>
      </div>

      {/* Create Input */}
      {creating && (
        <div className="px-4 pb-3 animate-fade-in">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder="输入名称..."
              className="flex-1 px-2.5 py-1.5 text-[13px] rounded-[var(--radius-sm)] bg-surface-elevated border border-border outline-none focus:border-accent"
            />
            <Button size="sm" onClick={handleCreate}>
              确定
            </Button>
          </div>
        </div>
      )}

      {/* KB List */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {loading ? (
          <SidebarSkeleton />
        ) : knowledgeBases.map((kb) => (
          <div
            key={kb.id}
            role="button"
            tabIndex={0}
            onClick={() => handleNavigate(`/kb/${kb.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleNavigate(`/kb/${kb.id}`);
            }}
            className={`
              w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)]
              text-left transition-all duration-[var(--duration-fast)] group cursor-pointer
              ${
                kbId === kb.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }
            `}
          >
            <MessageSquare size={16} className="shrink-0" />
            <span className="flex-1 text-[13px] font-medium truncate">
              {kb.name}
            </span>
            <span className="text-[11px] text-text-tertiary">
              {kb.document_count}
            </span>
            <button
              onClick={(e) => handleDelete(e, kb.id)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-danger/10 hover:text-danger transition-all"
            >
              <Trash2 size={13} />
            </button>
            <ChevronRight
              size={14}
              className={`shrink-0 transition-transform ${
                kbId === kb.id ? 'rotate-90' : ''
              }`}
            />
          </div>
        ))}
      </nav>


      {/* Footer */}
      <div className="p-4 border-t border-border-light">
        <p className="text-[11px] text-text-tertiary text-center">
          Powered by DeepSeek + RAG
        </p>
      </div>
    </aside>
  );
}
