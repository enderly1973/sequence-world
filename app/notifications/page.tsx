"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Notification = {
  id: string;
  notification_type: string;
  title: string;
  content: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

type FilterType =
  | "all"
  | "unread";

export default function NotificationsPage() {
  const router = useRouter();

  const [
    notifications,
    setNotifications,
  ] = useState<Notification[]>([]);

  const [
    filter,
    setFilter,
  ] = useState<FilterType>("all");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function loadNotifications() {
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
        .from("notifications")
        .select(`
          id,
          notification_type,
          title,
          content,
          link,
          is_read,
          created_at,
          read_at
        `)
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(100);

      if (error) {
        throw error;
      }

      setNotifications(
        (data ?? []) as Notification[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取通知時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const unreadCount =
    useMemo(
      () =>
        notifications.filter(
          (notification) =>
            !notification.is_read
        ).length,
      [notifications]
    );

  const displayedNotifications =
    useMemo(() => {
      if (filter === "unread") {
        return notifications.filter(
          (notification) =>
            !notification.is_read
        );
      }

      return notifications;
    }, [notifications, filter]);

  async function handleOpen(
    notification: Notification
  ) {
    try {
      if (!notification.is_read) {
        const {
          error,
        } = await supabase.rpc(
          "mark_notification_read",
          {
            p_notification_id:
              notification.id,
          }
        );

        if (error) {
          throw error;
        }

        setNotifications(
          (current) =>
            current.map((item) =>
              item.id ===
              notification.id
                ? {
                    ...item,
                    is_read: true,
                    read_at:
                      new Date().toISOString(),
                  }
                : item
            )
        );
      }

      if (notification.link) {
        router.push(
          notification.link
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "開啟通知時發生錯誤。"
      );
    }
  }

  async function handleMarkAllRead() {
    if (
      processing ||
      unreadCount === 0
    ) {
      return;
    }

    setProcessing(true);
    setErrorMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "mark_all_notifications_read"
      );

      if (error) {
        throw error;
      }

      const now =
        new Date().toISOString();

      setNotifications(
        (current) =>
          current.map(
            (notification) => ({
              ...notification,
              is_read: true,
              read_at:
                notification.read_at ??
                now,
            })
          )
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "更新通知時發生錯誤。"
      );
    } finally {
      setProcessing(false);
    }
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
    ).format(new Date(value));
  }

  function getTypeLabel(
    type: string
  ) {
    if (
      type ===
      "relation_request"
    ) {
      return "歸屬";
    }

    if (
      type ===
      "relation_request_result"
    ) {
      return "歸屬";
    }

    if (
      type ===
      "task_received"
    ) {
      return "任務";
    }

    if (
      type ===
      "task_completed"
    ) {
      return "任務";
    }

    if (
      type ===
      "competition_challenge"
    ) {
      return "競技";
    }

    if (
      type ===
      "competition_accepted"
    ) {
      return "競技";
    }

    if (
      type ===
      "competition_completed"
    ) {
      return "競技";
    }

    return "世界";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取通知…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              通知中心
            </h1>

            <p className="mt-3 text-neutral-400">
              查看世界中與你有關的重要事件。
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

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-500">
              未讀通知
            </p>

            <p className="mt-3 text-4xl font-semibold">
              {unreadCount}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-500">
              全部通知
            </p>

            <p className="mt-3 text-4xl font-semibold">
              {notifications.length}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setFilter("all")
                }
                className={
                  filter === "all"
                    ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                    : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
                }
              >
                全部
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilter(
                    "unread"
                  )
                }
                className={
                  filter === "unread"
                    ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                    : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
                }
              >
                未讀
              </button>
            </div>

            <button
              type="button"
              disabled={
                processing ||
                unreadCount === 0
              }
              onClick={
                handleMarkAllRead
              }
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              全部標記已讀
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          {displayedNotifications.length ===
          0 ? (
            <div className="rounded-xl bg-neutral-950 p-6 text-center text-neutral-500">
              {filter === "unread"
                ? "目前沒有未讀通知。"
                : "目前沒有通知。"}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedNotifications.map(
                (notification) => (
                  <button
                    key={
                      notification.id
                    }
                    type="button"
                    onClick={() =>
                      handleOpen(
                        notification
                      )
                    }
                    className={`block w-full rounded-xl border p-5 text-left transition ${
                      notification.is_read
                        ? "border-neutral-800 bg-neutral-950 hover:border-neutral-600"
                        : "border-amber-900/50 bg-amber-950/10 hover:border-amber-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {!notification.is_read && (
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                          )}

                          <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-500">
                            {getTypeLabel(
                              notification.notification_type
                            )}
                          </span>
                        </div>

                        <p className="mt-3 text-lg font-medium">
                          {
                            notification.title
                          }
                        </p>

                        <p className="mt-2 text-sm leading-6 text-neutral-400">
                          {
                            notification.content
                          }
                        </p>
                      </div>

                      <div className="text-right text-xs text-neutral-600">
                        {formatDate(
                          notification.created_at
                        )}
                      </div>
                    </div>

                    {notification.link && (
                      <p className="mt-4 text-sm text-neutral-500">
                        點擊查看詳情 →
                      </p>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}