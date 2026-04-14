import { BookOpen, Upload, MessageSquare, Zap, ArrowRight } from 'lucide-react';

export function HomePage() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 relative overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[15%] left-[20%] w-[400px] h-[400px] rounded-full bg-accent/8 blur-[100px] animate-orb-1" />
        <div className="absolute bottom-[10%] right-[15%] w-[350px] h-[350px] rounded-full bg-[oklch(70%_0.15_300)]/8 blur-[100px] animate-orb-2" />
        <div className="absolute top-[50%] left-[55%] w-[300px] h-[300px] rounded-full bg-[oklch(75%_0.12_200)]/6 blur-[100px] animate-orb-3" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 max-w-[520px] text-center animate-fade-in px-4">
        {/* Logo */}
        <div className="relative w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 md:mb-8">
          <div className="absolute inset-0 rounded-[var(--radius-xl)] bg-accent/20 blur-xl animate-pulse" />
          <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-[var(--radius-xl)] bg-gradient-to-br from-accent to-[oklch(48%_0.25_270)] flex items-center justify-center shadow-lg">
            <BookOpen size={32} className="text-white md:hidden" />
            <BookOpen size={40} className="text-white hidden md:block" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-[28px] md:text-[38px] font-bold tracking-tight mb-3 bg-gradient-to-r from-text-primary via-text-primary to-accent bg-clip-text text-transparent">
          AI 知识库助手
        </h1>
        <p className="text-[14px] md:text-[16px] text-text-secondary leading-relaxed mb-8 md:mb-12 max-w-[380px] mx-auto">
          上传文档，构建专属知识库
          <br />
          基于 RAG 技术，让 AI 精准回答你的问题
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 md:mb-10">
          <FeatureCard
            icon={<Upload size={20} />}
            title="上传文档"
            desc="PDF、Word、TXT、Markdown"
          />
          <FeatureCard
            icon={<Zap size={20} />}
            title="智能解析"
            desc="自动分块、向量化存储"
          />
          <FeatureCard
            icon={<MessageSquare size={20} />}
            title="精准问答"
            desc="引用溯源、流式输出"
          />
        </div>

        {/* CTA hint */}
        <div className="flex items-center justify-center gap-2 text-[13px] text-text-tertiary">
          <span>从左侧新建知识库开始</span>
          <ArrowRight size={14} className="animate-bounce-x" />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="group flex flex-col items-center gap-2.5 p-5 rounded-[var(--radius-lg)] bg-surface-elevated/80 backdrop-blur-sm border border-border-light hover:border-accent/30 hover:shadow-md transition-all duration-300 cursor-default">
      <div className="w-11 h-11 rounded-[var(--radius-md)] bg-accent-light flex items-center justify-center text-accent group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-[13px] font-semibold">{title}</h3>
      <p className="text-[11px] text-text-tertiary leading-snug">{desc}</p>
    </div>
  );
}
