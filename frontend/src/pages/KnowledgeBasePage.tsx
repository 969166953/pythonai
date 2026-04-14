import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, MessageSquare, Plus } from 'lucide-react';
import { api } from '../lib/api';
import type { KnowledgeBase, Conversation } from '../lib/api';
import { DocumentList } from '../components/knowledge-base/DocumentList';
import { ChatView } from '../components/chat/ChatView';
import { Button } from '../components/ui/Button';
import { KBHeaderSkeleton, DocumentSkeleton } from '../components/ui/Skeleton';

type Tab = 'documents' | 'chat';

export function KnowledgeBasePage() {
  const { kbId, conversationId } = useParams();
  const navigate = useNavigate();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tab, setTab] = useState<Tab>(conversationId ? 'chat' : 'documents');

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
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">
            {kb.name}
          </h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">
            {kb.document_count} 个文档
          </p>
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
                <button
                  key={conv.id}
                  onClick={() => navigate(`/kb/${kbId}/chat/${conv.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-surface-elevated border border-border-light hover:border-border text-left transition-all group"
                >
                  <MessageSquare
                    size={16}
                    className="text-text-tertiary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate">
                      {conv.title || '新对话'}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      {new Date(conv.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
