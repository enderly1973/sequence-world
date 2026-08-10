"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AnnouncementType =
  | "general"
  | "event"
  | "system";

type Announcement = {
  id: string;
  title: string;
  content: string;
  announcement_type: AnnouncementType;
  is_pinned: boolean;
  created_at: string;
};

type FilterType =
  | "all"
  | AnnouncementType;

export default function AnnouncementsPage() {
  const router = useRouter();

  const [
    announcements,
    setAnnouncements,
  ] = useState<Announcement[]>([]);

  const [
    filter,
    setFilter,
  ] = useState<FilterType>("all");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("world_announcements")
        .select(`
          id,
          title,
          content,
          announcement_type,
          is_pinned,
          created_at
        `)
        .eq("is_active", true)
        .order("is_pinned", {
          ascending: false,
        })
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setAnnouncements(
        (data ?? []) as Announcement[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取公告時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredAnnouncements =
    useMemo(() => {
      if (filter === "all") {
        return announcements;
      }

      return announcements.filter(
        (announcement) =>
          announcement.announcement_type ===
          filter
      );
    }, [
      announcements,
      filter,
    ]);

  function getTypeLabel(
    type: AnnouncementType
  ) {
    if (type === "event") {
      return "活動";
    }

    if (type === "system") {
      return "系統";
    }

    return "一般";
  }

  function getTypeClass(
    type: AnnouncementType
  ) {
    if (type === "event") {
      return "border-amber-800 text-amber-300";
    }

    if (type === "system") {
      return "border-red-900 text-red-300";
    }

    return "border-neutral-700 text-neutral-400";
  }

  function formatDate(
    value: string
  ) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(
      new Date(value)
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界公告…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-5xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">

          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              世界公告
            </h1>

            <p className="mt-3 text-neutral-400">
              查看世界目前的重要消息、活動與系統通知。
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            返回主頁
          </Link>

        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">

          <div className="flex flex-wrap gap-2">

            {[
              ["all", "全部"],
              ["general", "一般"],
              ["event", "活動"],
              ["system", "系統"],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setFilter(
                      value as FilterType
                    )
                  }
                  className={
                    filter === value
                      ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                      : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition hover:border-neutral-500 hover:text-white"
                  }
                >
                  {label}
                </button>
              )
            )}

          </div>

        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          {filteredAnnouncements.length ===
          0 ? (
            <div className="rounded-xl bg-neutral-950 p-6 text-center text-neutral-500">
              目前沒有公告。
            </div>
          ) : (
            <div className="space-y-4">

              {filteredAnnouncements.map(
                (announcement) => (
                  <article
                    key={
                      announcement.id
                    }
                    className={`rounded-xl border p-6 ${
                      announcement.is_pinned
                        ? "border-amber-900/60 bg-amber-950/10"
                        : "border-neutral-800 bg-neutral-950"
                    }`}
                  >

                    <div className="flex flex-wrap items-start justify-between gap-4">

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2">

                          {announcement.is_pinned && (
                            <span className="rounded-full border border-amber-800 px-2.5 py-1 text-xs text-amber-300">
                              置頂
                            </span>
                          )}

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs ${getTypeClass(
                              announcement.announcement_type
                            )}`}
                          >
                            {getTypeLabel(
                              announcement.announcement_type
                            )}
                          </span>

                        </div>

                        <h2 className="mt-4 text-xl font-semibold">
                          {
                            announcement.title
                          }
                        </h2>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-400">
                          {
                            announcement.content
                          }
                        </p>

                      </div>

                      <p className="text-xs text-neutral-600">
                        {formatDate(
                          announcement.created_at
                        )}
                      </p>

                    </div>

                  </article>
                )
              )}

            </div>
          )}

        </section>

      </div>
    </main>
  );
}