import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, MessageSquare, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { api } from '../lib/api';
import type { KnowledgeBase, Conversation } from '../lib/api';
import { DocumentList } from '../components/knowledge-base/DocumentList';
import { ChatView } from '../components/chat/ChatView';
import { Button } from '../components/ui/Button';
import { KBHeaderSkeleton, DocumentSkeleton } from '../components/ui/Skeleton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

type Tab = 'documents' | 'chat';

export function KnowledgeBasePage() {
  const { kbId, conversationId } = useParams();
  const navigate = useNavigate();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tab, setTab] = useState<Tab>(conversationId ? 'chat' : 'documents');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConvId, setDeleteConvId] = useState<string | null>(null);
  const [editingKb, setEditingKb] = useState(false);
  const [kbName, setKbName] = useState('');
  const [kbDesc, setKbDesc] = useState('');
  const { toast } = useToast();

  const loadKb = useCallback(async () => {
    if (!kbId) return;
    const res = await api.knowledgeBases.get(kbId);
    if (res.success && res.data) setKb(res.data);
  }, [kbId]);

  const loadConversations = useCallback(async () => {
    if (!kbId) return;
    const res = await api.conversations.list(kbId);
    if (res.success && res.data) setConversations(res.data);
  }, [kbId]);

  useEffect(() => {
    loadKb();
    loadConversations();
  }, [loadKb, loadConversations]);

  useEffect(() => {
    if (conversationId) setTab('chat');
  }, [conversationId]);

  const handleNewChat = async () => {
    if (!kbId) return;
    const res = await api.conversations.create(kbId);
    if (res.success && res.data) {
      setConversations((prev) => [res.data!, ...prev]);
      navigate(`/kb/${kbId}/chat/${res.data.id}`);
    }
  };

  const handleStartEditKb = () => {
    if (!kb) return;
    setKbName(kb.name);
    setKbDesc(kb.description);
    setEditingKb(true);
  };

  const handleSaveKb = async () => {
    if (!kbId || !kbName.trim()) return;
    const res = await api.knowledgeBases.update(kbId, {
      name: kbName.trim(),
      description: kbDesc.trim(),
    });
    if (res.success && res.data) {
      setKb(res.data);
      toast('知识库已更新');
    } else {
      toast(res.error || '更新失败', 'error');
    }
    setEditingKb(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    setDeleteConvId(convId);
  };

  const handleConfirmDeleteConv = async () => {
    if (!kbId || !deleteConvId) return;
    const res = await api.conversations.delete(kbId, deleteConvId);
    if (res.success) {
      setConversations((prev) => prev.filter((c) => c.id !== deleteConvId));
      if (conversationId === deleteConvId) navigate(`/kb/${kbId}`);
      toast('对话已删除');
    } else {
      toast(res.error || '删除失败', 'error');
    }
    setDeleteConvId(null);
  };

  const handleStartRename = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleConfirmRename = async (e: React.SyntheticEvent, convId: string) => {
    e.stopPropagation();
    if (!kbId || !editTitle.trim()) return;
    const res = await api.conversations.rename(kbId, convId, editTitle.trim());
    if (res.success && res.data) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: res.data!.title } : c))
      );
      toast('对话已重命名');
    } else {
      toast(res.error || '重命名失败', 'error');
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  if (!kb) {
    return (
      <div className="flex-1 flex flex-col h-screen">
        <KBHeaderSkeleton />
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[720px] mx-auto">
            <DocumentSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-4">
          {editingKb ? (
            <div className="flex items-center gap-2 animate-fade-in">
              <div className="flex-1 space-y-1.5">
                <input
                  autoFocus
                  value={kbName}
                  onChange={(e) => setKbName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveKb();
                    if (e.key === 'Escape') setEditingKb(false);
                  }}
                  placeholder="知识库名称"
                  className="w-full px-2.5 py-1 text-[16px] font-semibold rounded-[var(--radius-sm)] bg-surface border border-border outline-none focus:border-accent"
                />
                <input
                  value={kbDesc}
                  onChange={(e) => setKbDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveKb();
                    if (e.key === 'Escape') setEditingKb(false);
                  }}
                  placeholder="描述（可选）"
                  className="w-full px-2.5 py-1 text-[13px] rounded-[var(--radius-sm)] bg-surface border border-border outline-none focus:border-accent"
                />
              </div>
              <button onClick={handleSaveKb} className="p-1.5 text-accent hover:bg-accent/10 rounded-[var(--radius-sm)] transition-colors">
                <Check size={18} />
              </button>
              <button onClick={() => setEditingKb(false)} className="p-1.5 text-text-tertiary hover:bg-surface-secondary rounded-[var(--radius-sm)] transition-colors">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="group cursor-pointer" onClick={handleStartEditKb}>
              <div className="flex items-center gap-1.5">
                <h1 className="text-[20px] font-semibold tracking-tight">
                  {kb.name}
                </h1>
                <Pencil size={14} className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[13px] text-text-tertiary mt-0.5">
                {kb.description || `${kb.document_count} 个文档`}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-secondary rounded-[var(--radius-md)] p-0.5">
            <button
              onClick={() => {
                setTab('documents');
                navigate(`/kb/${kbId}`);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[13px] font-medium transition-all ${
                tab === 'documents'
                  ? 'bg-surface-elevated shadow-sm text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <FileText size={14} />
              文档
            </button>
            <button
              onClick={() => setTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-[13px] font-medium transition-all ${
                tab === 'chat'
                  ? 'bg-surface-elevated shadow-sm text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              <MessageSquare size={14} />
              对话
            </button>
          </div>
          {tab === 'chat' && (
            <Button size="sm" onClick={handleNewChat}>
              <Plus size={14} />
              新对话
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      {tab === 'documents' ? (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[720px] mx-auto">
            <DocumentList />
          </div>
        </div>
      ) : conversationId ? (
        <ChatView />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[720px] mx-auto space-y-2">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-16 h-16 rounded-[var(--radius-xl)] bg-surface-secondary flex items-center justify-center text-text-tertiary mb-4">
                  <MessageSquare size={28} />
                </div>
                <h3 className="text-[17px] font-semibold mb-1">开始对话</h3>
                <p className="text-[14px] text-text-tertiary mb-6">
                  基于知识库文档进行智能问答
                </p>
                <Button onClick={handleNewChat}>
                  <Plus size={16} />
                  新建对话
                </Button>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => editingId !== conv.id && navigate(`/kb/${kbId}/chat/${conv.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingId !== conv.id) navigate(`/kb/${kbId}/chat/${conv.id}`);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-surface-elevated border border-border-light hover:border-border text-left transition-all group cursor-pointer"
                >
                  <MessageSquare
                    size={16}
                    className="text-text-tertiary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {editingId === conv.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename(e, conv.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 px-2 py-0.5 text-[13px] rounded-[var(--radius-sm)] bg-surface border border-border outline-none focus:border-accent"
                        />
                        <button onClick={(e) => handleConfirmRename(e, conv.id)} className="p-0.5 text-accent hover:bg-accent/10 rounded">
                          <Check size={14} />
                        </button>
                        <button onClick={handleCancelRename} className="p-0.5 text-text-tertiary hover:bg-surface-secondary rounded">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {conv.title || '新对话'}
                        </p>
                        <p className="text-[11px] text-text-tertiary">
                          {new Date(conv.created_at).toLocaleString('zh-CN')}
                        </p>
                      </>
                    )}
                  </div>
                  {editingId !== conv.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleStartRename(e, conv)}
                        className="p-1 rounded hover:bg-surface-secondary text-text-tertiary hover:text-text-primary transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, conv.id)}
                        className="p-1 rounded hover:bg-danger/10 text-text-tertiary hover:text-danger transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteConvId !== null}
        title="删除对话"
        message="删除后对话记录将无法恢复，确定要删除吗？"
        onConfirm={handleConfirmDeleteConv}
        onCancel={() => setDeleteConvId(null)}
      />
    </div>
  );
}
