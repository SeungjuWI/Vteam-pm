"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";
import { getUnreadDiscussionCount, markDiscussionRead } from "./discussion-actions";

const ProjectDiscussion = dynamic(() => import("./project-discussion"));

export default function ProjectDiscussionButton({ projectId, currentUserId }: { projectId: string; currentUserId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    getUnreadDiscussionCount(projectId).then(setUnread);
  }, [projectId]);

  // 닫혀 있을 때 들어오는 새 글/댓글을 배지에 누적
  useEffect(() => {
    const supabase = createClient();
    const bump = (payload: { new: Record<string, unknown> }) => {
      const n = payload.new as { author_id: string };
      if (n.author_id === currentUserId) return;
      if (openRef.current) return;
      setUnread((u) => u + 1);
    };
    const channel = supabase
      .channel(`project_discussion_badge_${projectId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_posts", filter: `project_id=eq.${projectId}` }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_post_replies", filter: `project_id=eq.${projectId}` }, bump)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, currentUserId]);

  async function handleOpen() {
    setOpen(true);
    setUnread(0);
    await markDiscussionRead(projectId);
  }

  async function handleClose() {
    setOpen(false);
    await markDiscussionRead(projectId);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500 active:scale-[0.95]"
        aria-label={t("discussion.title")}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/20" onClick={handleClose} />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">{t("discussion.title")}</h2>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-[0.95]"
                aria-label={t("common.close")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ProjectDiscussion projectId={projectId} currentUserId={currentUserId} />
          </aside>
        </div>
      )}
    </>
  );
}
