import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex[:12]


# TODO: 用户模型 — 启用认证时取消注释
# class UserModel(Base):
#     __tablename__ = "users"
#     id: Mapped[str] = mapped_column(String(12), primary_key=True, default=new_id)
#     email: Mapped[str] = mapped_column(String(255), unique=True)
#     hashed_password: Mapped[str] = mapped_column(String(255))
#     name: Mapped[str] = mapped_column(String(100), default="")
#     created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
#     knowledge_bases: Mapped[list["KnowledgeBaseModel"]] = relationship(back_populates="owner")


class KnowledgeBaseModel(Base):
    __tablename__ = "knowledge_bases"

    id: Mapped[str] = mapped_column(String(12), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    # TODO: 用户归属 — 启用认证时取消注释
    # owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True)
    # owner: Mapped["UserModel"] = relationship(back_populates="knowledge_bases")

    documents: Mapped[list["DocumentModel"]] = relationship(
        back_populates="knowledge_base", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["ConversationModel"]] = relationship(
        back_populates="knowledge_base", cascade="all, delete-orphan"
    )


class DocumentModel(Base):
    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_kb_id", "kb_id"),)

    id: Mapped[str] = mapped_column(String(12), primary_key=True, default=new_id)
    kb_id: Mapped[str] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="processing")
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    knowledge_base: Mapped["KnowledgeBaseModel"] = relationship(back_populates="documents")


class ConversationModel(Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_kb_id", "kb_id"),)

    id: Mapped[str] = mapped_column(String(12), primary_key=True, default=new_id)
    kb_id: Mapped[str] = mapped_column(ForeignKey("knowledge_bases.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200), default="新对话")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    knowledge_base: Mapped["KnowledgeBaseModel"] = relationship(back_populates="conversations")
    messages: Mapped[list["MessageModel"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class MessageModel(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation_id", "conversation_id"),)

    id: Mapped[str] = mapped_column(String(12), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    sources: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    # TODO: 消息反馈 — 用户点赞/点踩，用于优化检索质量
    # feedback: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "like" / "dislike"
    # TODO: token 用量统计 — 追踪每次对话的 token 消耗
    # token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    conversation: Mapped["ConversationModel"] = relationship(back_populates="messages")
