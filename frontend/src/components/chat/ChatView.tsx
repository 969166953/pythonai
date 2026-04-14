import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Paperclip, StopCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../../lib/api';
import { api } from '../../lib/api';
import { ChatSkeleton } from '../ui/Skeleton';

export function ChatView() {
  const { kbId, conversationId } = useParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!kbId || !conversationId) return;
    setLoading(true);
    api.conversations.messages(kbId, conversationId).then((res) => {
      if (res.success && res.data) setMessages(res.data);
      setLoading(false);
    });
  }, [kbId, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const stopStreaming = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (streamContent) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: streamContent },
      ]);
      setStreamContent('');
    }
    setStreaming(false);
  };

  const handleSend = () => {
    if (!input.trim() || !kbId || !conversationId || streaming) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setStreaming(true);
    setStreamContent('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const es = api.chat(kbId, conversationId, userMessage.content);
    eventSourceRef.current = es;

    let accumulated = '';
    let sources: ChatMessage['sources'] = [];

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'token') {
        accumulated += data.content;
        setStreamContent(accumulated);
      } else if (data.type === 'sources') {
        sources = data.sources;
      } else if (data.type === 'done') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: accumulated, sources },
        ]);
        setStreamContent('');
        setStreaming(false);
        es.close();
      }
    };

    es.onerror = () => {
      if (accumulated) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: accumulated },
        ]);
      }
      setStreamContent('');
      setStreaming(false);
      es.close();
    };
  };

  if (loading) {
    return <ChatSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6">
        <div className="max-w-[720px] mx-auto space-y-4 md:space-y-6">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          {streaming && streamContent && (
            <MessageBubble
              message={{ role: 'assistant', content: streamContent }}
              isStreaming
            />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border-light bg-surface-elevated/80 backdrop-blur-xl px-3 md:px-6 py-3 md:py-4">
        <div className="max-w-[720px] mx-auto">
          <div className="flex items-end gap-3 bg-surface rounded-[var(--radius-lg)] border border-border p-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10 transition-all">
            <button className="p-2 text-text-tertiary hover:text-text-secondary rounded-[var(--radius-sm)] hover:bg-surface-secondary transition-colors">
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入你的问题..."
              rows={1}
              className="flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-tertiary outline-none resize-none max-h-[160px] py-2"
            />
            {streaming ? (
              <button
                onClick={stopStreaming}
                className="p-2 text-danger hover:bg-danger/10 rounded-[var(--radius-sm)] transition-colors"
              >
                <StopCircle size={20} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover disabled:opacity-30 transition-all"
              >
                <Send size={18} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-tertiary text-center mt-2">
            基于知识库文档的 AI 问答，回答可能不完全准确
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}
    >
      <div
        className={`
          max-w-[85%] px-4 py-3 text-[14px] leading-relaxed
          ${
            isUser
              ? 'bg-accent text-white rounded-[var(--radius-lg)] rounded-br-[var(--radius-sm)]'
              : 'bg-surface-elevated border border-border-light rounded-[var(--radius-lg)] rounded-bl-[var(--radius-sm)] shadow-sm'
          }
        `}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className={`prose prose-sm max-w-none ${isStreaming ? 'typing-cursor' : ''}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border-light/50">
            <p className="text-[11px] font-medium text-text-tertiary mb-1.5">
              引用来源
            </p>
            {message.sources.map((src, i) => (
              <div
                key={i}
                className="text-[12px] text-text-secondary bg-surface-secondary rounded-[var(--radius-sm)] px-2.5 py-1.5 mb-1 line-clamp-2"
              >
                <span className="font-medium">{src.filename}</span>
                {' — '}
                {src.chunk}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
