"use client";

import {
  useEffect,
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
  is_active: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  role:
    | "founder"
    | "administrator"
    | "manager"
    | "member";
};

export default function AnnouncementAdminPage() {
  const router = useRouter();

  const [
    announcements,
    setAnnouncements,
  ] = useState<Announcement[]>([]);

  const [title, setTitle] =
    useState("");

  const [content, setContent] =
    useState("");

  const [
    announcementType,
    setAnnouncementType,
  ] =
    useState<AnnouncementType>(
      "general"
    );

  const [
    isPinned,
    setIsPinned,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          role
        `)
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const profile =
        profileData as Profile;

      if (
        profile.role !==
          "administrator" &&
        profile.role !==
          "founder"
      ) {
        router.replace(
          "/dashboard"
        );
        return;
      }

      await loadAnnouncements();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取公告管理頁時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAnnouncements() {
    const {
      data,
      error,
    } = await supabase
      .from(
        "world_announcements"
      )
      .select(`
        id,
        title,
        content,
        announcement_type,
        is_pinned,
        is_active,
        created_at
      `)
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
  }

  async function handleCreate() {
    if (submitting) {
      return;
    }

    if (!title.trim()) {
      setErrorMessage(
        "請輸入公告標題。"
      );
      return;
    }

    if (!content.trim()) {
      setErrorMessage(
        "請輸入公告內容。"
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "create_world_announcement",
        {
          p_title:
            title.trim(),

          p_content:
            content.trim(),

          p_announcement_type:
            announcementType,

          p_is_pinned:
            isPinned,
        }
      );

      if (error) {
        throw error;
      }

      setTitle("");
      setContent("");
      setAnnouncementType(
        "general"
      );
      setIsPinned(false);

      setSuccessMessage(
        "公告已發布。"
      );

      await loadAnnouncements();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "發布公告時發生錯誤。"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(
    announcement: Announcement
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "update_world_announcement_status",
        {
          p_announcement_id:
            announcement.id,

          p_is_active:
            !announcement.is_active,
        }
      );

      if (error) {
        throw error;
      }

      await loadAnnouncements();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "更新公告狀態時發生錯誤。"
      );
    }
  }

  async function handleTogglePin(
    announcement: Announcement
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "update_world_announcement_pin",
        {
          p_announcement_id:
            announcement.id,

          p_is_pinned:
            !announcement.is_pinned,
        }
      );

      if (error) {
        throw error;
      }

      await loadAnnouncements();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "更新置頂狀態時發生錯誤。"
      );
    }
  }

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

  function formatDate(
    value: string
  ) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        timeZone:
          "Asia/Taipei",
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
        正在讀取公告管理…
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
              公告管理
            </h1>

            <p className="mt-3 text-neutral-400">
              發布與管理世界公告。
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/announcements"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              查看公告
            </Link>

            <Link
              href="/dashboard"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回主頁
            </Link>
          </div>
        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-emerald-300">
            {successMessage}
          </div>
        )}

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-500">
            NEW ANNOUNCEMENT
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            發布公告
          </h2>

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-sm text-neutral-400">
                標題
              </label>

              <input
                value={title}
                maxLength={100}
                onChange={(event) =>
                  setTitle(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-neutral-500"
                placeholder="輸入公告標題"
              />
            </div>

            <div>
              <label className="text-sm text-neutral-400">
                內容
              </label>

              <textarea
                value={content}
                maxLength={5000}
                rows={8}
                onChange={(event) =>
                  setContent(
                    event.target.value
                  )
                }
                className="mt-2 w-full resize-none rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none focus:border-neutral-500"
                placeholder="輸入公告內容"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm text-neutral-400">
                  公告類型
                </label>

                <select
                  value={
                    announcementType
                  }
                  onChange={(event) =>
                    setAnnouncementType(
                      event.target
                        .value as AnnouncementType
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
                >
                  <option value="general">
                    一般
                  </option>

                  <option value="event">
                    活動
                  </option>

                  <option value="system">
                    系統
                  </option>
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-4 md:mt-7">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(event) =>
                    setIsPinned(
                      event.target
                        .checked
                    )
                  }
                />

                <span>
                  發布後置頂
                </span>
              </label>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleCreate}
              className="w-full rounded-xl bg-neutral-100 px-5 py-3 font-medium text-neutral-950 transition hover:bg-white disabled:opacity-50"
            >
              {submitting
                ? "發布中…"
                : "發布公告"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-500">
            ANNOUNCEMENTS
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            公告管理
          </h2>

          {announcements.length ===
          0 ? (
            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-500">
              目前沒有公告。
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {announcements.map(
                (announcement) => (
                  <article
                    key={
                      announcement.id
                    }
                    className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400">
                            {getTypeLabel(
                              announcement.announcement_type
                            )}
                          </span>

                          {announcement.is_pinned && (
                            <span className="rounded-full border border-amber-800 px-2.5 py-1 text-xs text-amber-300">
                              置頂
                            </span>
                          )}

                          {!announcement.is_active && (
                            <span className="rounded-full border border-red-900 px-2.5 py-1 text-xs text-red-400">
                              已停用
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-lg font-semibold">
                          {
                            announcement.title
                          }
                        </h3>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-400">
                          {
                            announcement.content
                          }
                        </p>

                        <p className="mt-3 text-xs text-neutral-600">
                          {formatDate(
                            announcement.created_at
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePin(
                              announcement
                            )
                          }
                          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
                        >
                          {announcement.is_pinned
                            ? "取消置頂"
                            : "設為置頂"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleToggleActive(
                              announcement
                            )
                          }
                          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
                        >
                          {announcement.is_active
                            ? "停用公告"
                            : "重新啟用"}
                        </button>
                      </div>
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