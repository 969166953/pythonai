import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, FileText, Trash2, CheckCircle, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import type { Document } from '../../lib/api';
import { EmptyState } from '../ui/EmptyState';

export function DocumentList() {
  const { kbId } = useParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [chunks, setChunks] = useState<{ index: number; content: string }[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!kbId) return;
    const res = await api.documents.list(kbId);
    if (res.success && res.data) setDocuments(res.data);
  }, [kbId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Poll for processing documents
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing');
    if (!hasProcessing) return;

    const timer = setInterval(loadDocuments, 2000);
    return () => clearInterval(timer);
  }, [documents, loadDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || !kbId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await api.documents.upload(kbId, file);
        if (res.success && res.data) {
          setDocuments((prev) => [...prev, res.data!]);
        }
      }
    } catch {
      // 网络错误已在 api 层处理
    } finally {
      setUploading(false);
    }
  };

  const handleTogglePreview = async (docId: string) => {
    if (expandedDoc === docId) {
      setExpandedDoc(null);
      return;
    }
    if (!kbId) return;
    setExpandedDoc(docId);
    setLoadingChunks(true);
    const res = await api.documents.chunks(kbId, docId);
    if (res.success && res.data) {
      setChunks(res.data.chunks);
    }
    setLoadingChunks(false);
  };

  const handleDelete = async (docId: string) => {
    if (!kbId) return;
    const res = await api.documents.delete(kbId, docId);
    if (res.success) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  const statusIcon = (status: Document['status']) => {
    switch (status) {
      case 'ready':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'processing':
        return <Loader2 size={14} className="text-accent animate-spin" />;
      case 'error':
        return <AlertCircle size={14} className="text-danger" />;
    }
  };

  if (documents.length === 0 && !uploading) {
    return (
      <div>
        <DropZone
          dragOver={dragOver}
          setDragOver={setDragOver}
          onUpload={handleUpload}
          uploading={uploading}
        />
        <EmptyState
          icon={<FileText size={28} />}
          title="暂无文档"
          description="上传 PDF、Word、TXT 或 Markdown 文件，AI 将自动解析"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DropZone
        dragOver={dragOver}
        setDragOver={setDragOver}
        onUpload={handleUpload}
        uploading={uploading}
      />

      <div className="space-y-1">
        {documents.map((doc) => (
          <div key={doc.id}>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-surface-elevated border border-border-light hover:border-border transition-colors group cursor-pointer"
              onClick={() => doc.status === 'ready' && handleTogglePreview(doc.id)}
            >
              <FileText size={18} className="text-text-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text-primary truncate">
                  {doc.filename}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  {doc.chunk_count} 个片段
                </p>
              </div>
              <div className="flex items-center gap-2">
                {statusIcon(doc.status)}
                {doc.status === 'ready' && (
                  <ChevronDown
                    size={14}
                    className={`text-text-tertiary transition-transform ${expandedDoc === doc.id ? 'rotate-180' : ''}`}
                  />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-[var(--radius-sm)] hover:bg-danger/10 hover:text-danger text-text-tertiary transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {expandedDoc === doc.id && (
              <div className="ml-10 mr-4 mt-1 mb-2 border-l-2 border-accent/20 pl-4 animate-fade-in">
                {loadingChunks ? (
                  <div className="py-3 flex items-center gap-2 text-[12px] text-text-tertiary">
                    <Loader2 size={14} className="animate-spin" />
                    加载中...
                  </div>
                ) : chunks.length === 0 ? (
                  <p className="py-3 text-[12px] text-text-tertiary">暂无分块数据</p>
                ) : (
                  <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
                    {chunks.map((chunk) => (
                      <div
                        key={chunk.index}
                        className="px-3 py-2 rounded-[var(--radius-sm)] bg-surface-secondary text-[12px] text-text-secondary leading-relaxed"
                      >
                        <span className="text-[10px] text-text-tertiary font-mono mr-2">#{chunk.index + 1}</span>
                        {chunk.content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DropZone({
  dragOver,
  setDragOver,
  onUpload,
  uploading,
}: {
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onUpload: (files: FileList | null) => void;
  uploading: boolean;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onUpload(e.dataTransfer.files);
      }}
      className={`
        relative border-2 border-dashed rounded-[var(--radius-lg)] p-6
        flex flex-col items-center gap-2 transition-all cursor-pointer
        ${
          dragOver
            ? 'border-accent bg-accent-light scale-[1.01]'
            : 'border-border-light hover:border-border hover:bg-surface-secondary/50'
        }
      `}
    >
      <input
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md"
        onChange={(e) => onUpload(e.target.files)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      {uploading ? (
        <Loader2 size={24} className="text-accent animate-spin" />
      ) : (
        <Upload size={24} className="text-text-tertiary" />
      )}
      <p className="text-[13px] text-text-secondary">
        {uploading ? '正在上传...' : '拖拽文件到此处，或点击上传'}
      </p>
      <p className="text-[11px] text-text-tertiary">
        支持 PDF、Word、TXT、Markdown
      </p>
    </div>
  );
}
