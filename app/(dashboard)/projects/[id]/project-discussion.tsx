"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";
import {
  getProjectPosts,
  createProjectPost,
  deleteProjectPost,
  toggleProjectPostReaction,
  getProjectReplies,
  createProjectReply,
  deleteProjectReply,
  translateSingleProjectPost,
  translateSingleProjectReply,
} from "./discussion-actions";

interface Profile {
  name: string;
  avatar_url: string | null;
  position: string | null;
}

interface Post {
  id: string;
  author_id: string;
  content: string;
  author_language: string | null;
  created_at: string;
  translated_content: string | null;
  reaction_count: number;
  my_reaction: boolean;
  reply_count: number;
  profiles: Profile;
}

interface Reply {
  id: string;
  author_id: string;
  content: string;
  author_language: string | null;
  created_at: string;
  translated_content: string | null;
  profiles: Profile;
}

export default function ProjectDiscussion({ projectId, currentUserId }: { projectId: string; currentUserId: string }) {
  const t = useT();
  const [posts, setPosts] = useState<Post[]>([]);
  const [input, setInput] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [repliesByPost, setRepliesByPost] = useState<Record<string, Reply[]>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // realtime 콜백이 최신 열린 스레드 목록을 참조하기 위한 ref (updater를 순수하게 유지)
  const openThreadsRef = useRef<Set<string>>(openThreads);
  useEffect(() => { openThreadsRef.current = openThreads; }, [openThreads]);

  useEffect(() => {
    loadPosts();
  }, [projectId]);

  // Realtime: 글
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project_posts_${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_posts", filter: `project_id=eq.${projectId}` },
        async (payload: { new: Record<string, unknown> }) => {
          const np = payload.new as { id: string; author_id: string; content: string; author_language: string; created_at: string };
          if (np.author_id === currentUserId) return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url, position")
            .eq("id", np.author_id)
            .single();

          let translated_content: string | null = null;
          if (np.author_language) {
            translated_content = await translateSingleProjectPost(np.id, np.content, np.author_language);
          }

          const post: Post = {
            ...np,
            translated_content,
            reaction_count: 0,
            my_reaction: false,
            reply_count: 0,
            profiles: profile ?? { name: "?", avatar_url: null, position: null },
          };
          setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "project_posts", filter: `project_id=eq.${projectId}` },
        (payload: { old: Record<string, unknown> }) => {
          const old = payload.old as { id: string };
          setPosts((prev) => prev.filter((p) => p.id !== old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, currentUserId]);

  // Realtime: 댓글 (프로젝트 단위 구독 → 열린 스레드에 반영 + 댓글 수 갱신)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project_replies_${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_post_replies", filter: `project_id=eq.${projectId}` },
        async (payload: { new: Record<string, unknown> }) => {
          const nr = payload.new as { id: string; post_id: string; author_id: string; content: string; author_language: string; created_at: string };
          if (nr.author_id === currentUserId) return;

          setPosts((prev) => prev.map((p) => (p.id === nr.post_id ? { ...p, reply_count: p.reply_count + 1 } : p)));

          // 스레드가 열려 있을 때만 본문을 채워 넣음
          if (openThreadsRef.current.has(nr.post_id)) await appendIncomingReply(nr);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "project_post_replies", filter: `project_id=eq.${projectId}` },
        (payload: { old: Record<string, unknown> }) => {
          const old = payload.old as { id: string; post_id: string };
          setRepliesByPost((prev) => {
            const list = prev[old.post_id];
            if (!list) return prev;
            return { ...prev, [old.post_id]: list.filter((r) => r.id !== old.id) };
          });
          setPosts((prev) => prev.map((p) => (p.id === old.post_id ? { ...p, reply_count: Math.max(0, p.reply_count - 1) } : p)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, currentUserId]);

  async function appendIncomingReply(nr: { id: string; post_id: string; author_id: string; content: string; author_language: string; created_at: string }) {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, avatar_url, position")
      .eq("id", nr.author_id)
      .single();

    let translated_content: string | null = null;
    if (nr.author_language) {
      translated_content = await translateSingleProjectReply(nr.id, nr.content, nr.author_language);
    }

    const reply: Reply = {
      id: nr.id,
      author_id: nr.author_id,
      content: nr.content,
      author_language: nr.author_language,
      created_at: nr.created_at,
      translated_content,
      profiles: profile ?? { name: "?", avatar_url: null, position: null },
    };
    setRepliesByPost((prev) => {
      const list = prev[nr.post_id] ?? [];
      if (list.some((r) => r.id === reply.id)) return prev;
      return { ...prev, [nr.post_id]: [...list, reply] };
    });
  }

  async function loadPosts() {
    const data = await getProjectPosts(projectId);
    setPosts(data as unknown as Post[]);
  }

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    setIsWriting(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    startTransition(async () => {
      await createProjectPost(projectId, trimmed);
      await loadPosts();
    });
  }

  function handleDelete(postId: string) {
    if (!confirm(t("discussion.deleteConfirm"))) return;
    startTransition(async () => {
      await deleteProjectPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    });
  }

  function handleReaction(postId: string) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const was = p.my_reaction;
        return { ...p, my_reaction: !was, reaction_count: was ? p.reaction_count - 1 : p.reaction_count + 1 };
      })
    );
    startTransition(async () => { await toggleProjectPostReaction(postId); });
  }

  async function toggleThread(postId: string) {
    const willOpen = !openThreads.has(postId);
    setOpenThreads((prev) => {
      const next = new Set(prev);
      if (willOpen) next.add(postId);
      else next.delete(postId);
      return next;
    });
    if (willOpen && !repliesByPost[postId]) {
      const data = await getProjectReplies(postId);
      setRepliesByPost((prev) => ({ ...prev, [postId]: data as unknown as Reply[] }));
    }
  }

  function handleReplySubmit(postId: string) {
    const trimmed = (replyInputs[postId] ?? "").trim();
    if (!trimmed) return;
    setReplyInputs((prev) => ({ ...prev, [postId]: "" }));
    startTransition(async () => {
      await createProjectReply(projectId, postId, trimmed);
      const data = await getProjectReplies(postId);
      setRepliesByPost((prev) => ({ ...prev, [postId]: data as unknown as Reply[] }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reply_count: data.length } : p)));
    });
  }

  function handleReplyDelete(postId: string, replyId: string) {
    if (!confirm(t("discussion.deleteReplyConfirm"))) return;
    startTransition(async () => {
      await deleteProjectReply(replyId);
      setRepliesByPost((prev) => ({ ...prev, [postId]: (prev[postId] ?? []).filter((r) => r.id !== replyId) }));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reply_count: Math.max(0, p.reply_count - 1) } : p)));
    });
  }

  function toggleOriginal(id: string) {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return t("discussion.justNow");
    if (min < 60) return `${min}${t("discussion.minutesAgo")}`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}${t("discussion.hoursAgo")}`;
    return `${Math.floor(hr / 24)}${t("discussion.daysAgo")}`;
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5">
      {!isWriting && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => { setIsWriting(true); setTimeout(() => textareaRef.current?.focus(), 0); }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            {t("discussion.write")}
          </button>
        </div>
      )}

      {isWriting && (
        <div className="mb-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmit(); } }}
            placeholder={t("discussion.placeholder")}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => { setIsWriting(false); setInput(""); }} className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50">
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !input.trim()}
              className="rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-bold text-white transition-all duration-200 ease-spring hover:bg-blue-600 disabled:opacity-50 shadow-soft-sm active:scale-[0.98] hover:shadow-brand"
            >
              {t("discussion.submit")}
            </button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="flex h-24 items-center justify-center">
          <p className="text-sm text-gray-600">{t("discussion.empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => {
            const isMe = post.author_id === currentUserId;
            const isTranslated = !!post.translated_content;
            const showingOriginal = showOriginal.has(post.id);
            const displayContent = isTranslated && !showingOriginal ? post.translated_content! : post.content;
            const threadOpen = openThreads.has(post.id);
            const replies = repliesByPost[post.id] ?? [];

            return (
              <div key={post.id} className="rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar url={post.profiles.avatar_url} name={post.profiles.name} size={28} />
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{post.profiles.name}</span>
                      {post.profiles.position && <span className="text-xs text-gray-600">{post.profiles.position}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">{timeAgo(post.created_at)}</span>
                    {isMe && (
                      <button onClick={() => handleDelete(post.id)} className="text-xs text-gray-300 transition-colors hover:text-red-500 active:scale-[0.95]">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{displayContent}</p>
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    onClick={() => handleReaction(post.id)}
                    className={`flex items-center gap-1 text-xs transition-colors ${post.my_reaction ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={post.my_reaction ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    {post.reaction_count > 0 && <span>{post.reaction_count}</span>}
                  </button>
                  <button
                    onClick={() => toggleThread(post.id)}
                    className={`flex items-center gap-1 text-xs transition-colors ${threadOpen ? "text-blue-500" : "text-gray-400 hover:text-blue-400"}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                    <span>{post.reply_count > 0 ? `${post.reply_count}${t("discussion.replyCountSuffix")}` : t("discussion.openThread")}</span>
                  </button>
                  {isTranslated && (
                    <button onClick={() => toggleOriginal(post.id)} className="text-xs text-blue-500 hover:text-blue-600">
                      {showingOriginal ? t("discussion.translated") : t("discussion.original")}
                    </button>
                  )}
                </div>

                {/* 스레드 */}
                {threadOpen && (
                  <div className="mt-3 flex flex-col gap-2.5 border-l-2 border-gray-200 pl-3.5">
                    {replies.length === 0 ? (
                      <p className="py-1 text-xs text-gray-600">{t("discussion.noReplies")}</p>
                    ) : (
                      replies.map((reply) => {
                        const replyIsMe = reply.author_id === currentUserId;
                        const replyTranslated = !!reply.translated_content;
                        const replyShowingOriginal = showOriginal.has(reply.id);
                        const replyContent = replyTranslated && !replyShowingOriginal ? reply.translated_content! : reply.content;
                        return (
                          <div key={reply.id} className="flex gap-2.5">
                            <Avatar url={reply.profiles.avatar_url} name={reply.profiles.name} size={24} />
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-900">{reply.profiles.name}</span>
                                <span className="text-[11px] text-gray-300">{timeAgo(reply.created_at)}</span>
                                {replyIsMe && (
                                  <button onClick={() => handleReplyDelete(post.id, reply.id)} className="text-[11px] text-gray-300 transition-colors hover:text-red-500 active:scale-[0.95]">
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">{replyContent}</p>
                              {replyTranslated && (
                                <button onClick={() => toggleOriginal(reply.id)} className="mt-0.5 text-[11px] text-blue-500 hover:text-blue-600">
                                  {replyShowingOriginal ? t("discussion.translated") : t("discussion.original")}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* 댓글 입력 */}
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={replyInputs[post.id] ?? ""}
                        onChange={(e) => setReplyInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleReplySubmit(post.id); } }}
                        placeholder={t("discussion.replyPlaceholder")}
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none"
                      />
                      <button
                        onClick={() => handleReplySubmit(post.id)}
                        disabled={isPending || !(replyInputs[post.id] ?? "").trim()}
                        className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-bold text-white transition-all duration-200 ease-spring hover:bg-blue-600 disabled:opacity-50 shadow-soft-sm active:scale-[0.98] hover:shadow-brand"
                      >
                        {t("common.send")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
