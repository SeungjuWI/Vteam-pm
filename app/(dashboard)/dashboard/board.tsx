"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/avatar";
import { getPosts, createPost, deletePost, toggleReaction, translateSinglePost } from "../board/actions";

interface Post {
  id: string;
  author_id: string;
  content: string;
  author_language: string | null;
  created_at: string;
  translated_content: string | null;
  reaction_count: number;
  my_reaction: boolean;
  profiles: { name: string; avatar_url: string | null; position: string | null };
}

export default function Board({ currentUserId, companyId }: { currentUserId: string; companyId: string }) {
  const t = useT();
  const [posts, setPosts] = useState<Post[]>([]);
  const [input, setInput] = useState("");
  const [isWriting, setIsWriting] = useState(false);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("board_posts_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "board_posts", filter: `company_id=eq.${companyId}` },
        async (payload: { new: Record<string, unknown> }) => {
          const newPost = payload.new as { id: string; author_id: string; content: string; author_language: string; created_at: string };
          if (newPost.author_id === currentUserId) return; // 내가 쓴 건 이미 추가됨

          // 작성자 프로필 조회
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url, position")
            .eq("id", newPost.author_id)
            .single();

          let translated_content: string | null = null;
          if (newPost.author_language) {
            translated_content = await translateSinglePost(newPost.id, newPost.content, newPost.author_language);
          }

          const post: Post = {
            ...newPost,
            translated_content,
            reaction_count: 0,
            my_reaction: false,
            profiles: profile ?? { name: "?", avatar_url: null, position: null },
          };

          setPosts((prev) => [post, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "board_posts", filter: `company_id=eq.${companyId}` },
        (payload: { old: Record<string, unknown> }) => {
          const old = payload.old as { id: string };
          setPosts((prev) => prev.filter((p) => p.id !== old.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, currentUserId]);

  async function loadPosts() {
    const data = await getPosts();
    setPosts(data as unknown as Post[]);
  }

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    setIsWriting(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    startTransition(async () => {
      await createPost(trimmed);
      await loadPosts();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleDelete(postId: string) {
    if (!confirm(t("board.deleteConfirm"))) return;
    startTransition(async () => {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    });
  }

  function handleReaction(postId: string) {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const wasReacted = p.my_reaction;
        return {
          ...p,
          my_reaction: !wasReacted,
          reaction_count: wasReacted ? p.reaction_count - 1 : p.reaction_count + 1,
        };
      })
    );
    startTransition(async () => {
      await toggleReaction(postId);
    });
  }

  function toggleOriginal(postId: string) {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return t("board.justNow");
    if (min < 60) return `${min}${t("board.minutesAgo")}`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}${t("board.hoursAgo")}`;
    return `${Math.floor(hr / 24)}${t("board.daysAgo")}`;
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  return (
    <div className="rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900">{t("board.title")}</h2>
        {!isWriting && (
          <button
            onClick={() => { setIsWriting(true); setTimeout(() => textareaRef.current?.focus(), 0); }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
            </svg>
            {t("board.write")}
          </button>
        )}
      </div>

      {/* Input */}
      {isWriting && (
        <div className="mb-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
            onKeyDown={handleKeyDown}
            placeholder={t("board.placeholder")}
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:outline-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setIsWriting(false); setInput(""); }}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !input.trim()}
              className="rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {t("board.submit")}
            </button>
          </div>
        </div>
      )}

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="flex h-24 items-center justify-center">
          <p className="text-sm text-gray-400">{t("board.empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => {
            const isMe = post.author_id === currentUserId;
            const isTranslated = !!post.translated_content;
            const showingOriginal = showOriginal.has(post.id);
            const displayContent = isTranslated && !showingOriginal ? post.translated_content! : post.content;

            return (
              <div key={post.id} className="rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar url={post.profiles.avatar_url} name={post.profiles.name} size={28} />
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900">{post.profiles.name}</span>
                      {post.profiles.position && (
                        <span className="text-xs text-gray-400">{post.profiles.position}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">{timeAgo(post.created_at)}</span>
                    {isMe && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{displayContent}</p>
                <div className="flex items-center gap-3 mt-2.5">
                  <button
                    onClick={() => handleReaction(post.id)}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      post.my_reaction
                        ? "text-red-500"
                        : "text-gray-400 hover:text-red-400"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={post.my_reaction ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                    </svg>
                    {post.reaction_count > 0 && (
                      <span>{post.reaction_count}</span>
                    )}
                  </button>
                  {isTranslated && (
                    <button
                      onClick={() => toggleOriginal(post.id)}
                      className="text-xs text-blue-500 hover:text-blue-600"
                    >
                      {showingOriginal ? t("board.translated") : t("board.original")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
