const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '请求失败' }));
      return { success: false, error: err.detail || '请求失败' };
    }
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: '网络连接失败，请检查后端服务是否运行' };
  }
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  document_count: number;
  created_at: string;
}

export interface Document {
  id: string;
  filename: string;
  status: 'processing' | 'ready' | 'error';
  chunk_count: number;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { filename: string; chunk: string }[];
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export const api = {
  knowledgeBases: {
    list: () => request<KnowledgeBase[]>('/knowledge-bases'),
    create: (name: string, description: string) =>
      request<KnowledgeBase>('/knowledge-bases', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      }),
    get: (id: string) => request<KnowledgeBase>(`/knowledge-bases/${id}`),
    update: (id: string, data: { name?: string; description?: string }) =>
      request<KnowledgeBase>(`/knowledge-bases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/knowledge-bases/${id}`, { method: 'DELETE' }),
  },

  documents: {
    list: (kbId: string) =>
      request<Document[]>(`/knowledge-bases/${kbId}/documents`),
    upload: async (kbId: string, file: File): Promise<ApiResponse<Document>> => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(
          `${API_BASE}/knowledge-bases/${kbId}/documents`,
          { method: 'POST', body: formData }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: '上传失败' }));
          return { success: false, error: err.detail };
        }
        return { success: true, data: await res.json() };
      } catch {
        return { success: false, error: '网络连接失败，请检查后端服务是否运行' };
      }
    },
    chunks: (kbId: string, docId: string) =>
      request<{ chunks: { index: number; content: string }[] }>(
        `/knowledge-bases/${kbId}/documents/${docId}/chunks`
      ),
    delete: (kbId: string, docId: string) =>
      request<void>(`/knowledge-bases/${kbId}/documents/${docId}`, {
        method: 'DELETE',
      }),
  },

  conversations: {
    list: (kbId: string) =>
      request<Conversation[]>(`/knowledge-bases/${kbId}/conversations`),
    create: (kbId: string) =>
      request<Conversation>(`/knowledge-bases/${kbId}/conversations`, {
        method: 'POST',
      }),
    messages: (kbId: string, convId: string) =>
      request<ChatMessage[]>(
        `/knowledge-bases/${kbId}/conversations/${convId}/messages`
      ),
    rename: (kbId: string, convId: string, title: string) =>
      request<Conversation>(
        `/knowledge-bases/${kbId}/conversations/${convId}`,
        { method: 'PATCH', body: JSON.stringify({ title }) }
      ),
    delete: (kbId: string, convId: string) =>
      request<void>(
        `/knowledge-bases/${kbId}/conversations/${convId}`,
        { method: 'DELETE' }
      ),
  },

  chat: (kbId: string, convId: string, message: string): EventSource => {
    const params = new URLSearchParams({ message, kb_id: kbId, conversation_id: convId });
    return new EventSource(`${API_BASE}/chat/stream?${params}`);
  },
};
