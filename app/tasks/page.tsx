"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TaskStatus =
  | "pending"
  | "accepted"
  | "completed"
  | "cancelled";

type Task = {
  id: string;
  sender_id: string;
  receiver_id: string;
  title: string;
  content: string;
  status: TaskStatus;
  due_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  nickname: string;
  join_sequence: number;
};

type FilterType =
  | "all"
  | "pending"
  | "accepted"
  | "completed";

export default function TasksPage() {
  const router = useRouter();

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [profiles, setProfiles] =
    useState<Profile[]>([]);

  const [filter, setFilter] =
    useState<FilterType>("all");

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadTasks();
  }, []);

  async function loadTasks() {
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

      // =========================
      // 每日任務
      // 查看自己的任務
      // =========================

      const {
        error: missionError,
      } = await supabase.rpc(
        "complete_daily_mission",
        {
          p_mission_key:
            "view_tasks",
        }
      );

      if (missionError) {
        throw missionError;
      }

      // =========================
      // 收到的任務
      // =========================

      const {
        data: taskData,
        error: taskError,
      } = await supabase
        .from("tasks")
        .select(`
          id,
          sender_id,
          receiver_id,
          title,
          content,
          status,
          due_at,
          accepted_at,
          completed_at,
          cancelled_at,
          created_at
        `)
        .eq(
          "receiver_id",
          user.id
        )
        .order("created_at", {
          ascending: false,
        });

      if (taskError) {
        throw taskError;
      }

      const loadedTasks =
        (taskData ?? []) as Task[];

      setTasks(loadedTasks);

      // =========================
      // 取得發送者資料
      // =========================

      const senderIds = [
        ...new Set(
          loadedTasks.map(
            (task) =>
              task.sender_id
          )
        ),
      ];

      if (senderIds.length === 0) {
        setProfiles([]);
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          nickname,
          join_sequence
        `)
        .in("id", senderIds);

      if (profileError) {
        throw profileError;
      }

      setProfiles(
        (profileData ??
          []) as Profile[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取任務時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks =
    useMemo(() => {
      if (filter === "all") {
        return tasks;
      }

      return tasks.filter(
        (task) =>
          task.status === filter
      );
    }, [tasks, filter]);

  const counts = useMemo(
    () => ({
      pending: tasks.filter(
        (task) =>
          task.status ===
          "pending"
      ).length,

      accepted: tasks.filter(
        (task) =>
          task.status ===
          "accepted"
      ).length,

      completed: tasks.filter(
        (task) =>
          task.status ===
          "completed"
      ).length,
    }),
    [tasks]
  );

  function getProfile(
    id: string
  ) {
    return (
      profiles.find(
        (profile) =>
          profile.id === id
      ) ?? null
    );
  }

  function formatSequence(
    sequence: number
  ) {
    return String(
      sequence
    ).padStart(6, "0");
  }

  function formatDate(
    date: string | null
  ) {
    if (!date) {
      return "未設定";
    }

    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(date));
  }

  function getStatusLabel(
    status: TaskStatus
  ) {
    if (status === "pending") {
      return "待接受";
    }

    if (status === "accepted") {
      return "進行中";
    }

    if (status === "completed") {
      return "已完成";
    }

    return "已取消";
  }

  function getStatusClass(
    status: TaskStatus
  ) {
    if (status === "pending") {
      return "border-amber-900/60 bg-amber-950/20 text-amber-300";
    }

    if (status === "accepted") {
      return "border-blue-900/60 bg-blue-950/20 text-blue-300";
    }

    if (status === "completed") {
      return "border-emerald-900/60 bg-emerald-950/20 text-emerald-300";
    }

    return "border-neutral-700 bg-neutral-900 text-neutral-500";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取任務…
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
              我的任務
            </h1>

            <p className="mt-3 text-neutral-400">
              查看收到的任務與目前完成狀態。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/daily-missions"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              每日任務
            </Link>

            <Link
              href="/tasks/sent"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              我發出的任務
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

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              待接受
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {counts.pending}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              進行中
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {counts.accepted}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              已完成
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {counts.completed}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "全部"],
              ["pending", "待接受"],
              ["accepted", "進行中"],
              ["completed", "已完成"],
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
          {filteredTasks.length === 0 ? (
            <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有符合條件的任務。
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map(
                (task) => {
                  const sender =
                    getProfile(
                      task.sender_id
                    );

                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="block rounded-xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-neutral-600 hover:bg-neutral-900"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-medium">
                            {task.title}
                          </p>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-400">
                            {task.content}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-500">
                            <span>
                              發送者：
                              {sender
                                ? sender.nickname
                                : "未知成員"}
                            </span>

                            {sender && (
                              <span>
                                序號{" "}
                                {formatSequence(
                                  sender.join_sequence
                                )}
                              </span>
                            )}

                            <span>
                              發送時間：
                              {formatDate(
                                task.created_at
                              )}
                            </span>

                            {task.due_at && (
                              <span>
                                截止：
                                {formatDate(
                                  task.due_at
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
                            task.status
                          )}`}
                        >
                          {getStatusLabel(
                            task.status
                          )}
                        </span>
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}