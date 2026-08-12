"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TaskStatus =
  | "pending"
  | "accepted"
  | "submitted"
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
  reward_points: number;
  penalty_points: number;
  penalty_applied_at: string | null;
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
  | "submitted"
  | "overdue"
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
          reward_points,
          penalty_points,
          penalty_applied_at,
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

  function isTaskOverdue(task: Task) {
    return Boolean(
      task.due_at &&
      task.status !== "completed" &&
      task.status !== "cancelled" &&
      new Date(task.due_at).getTime() < Date.now()
    );
  }

  const filteredTasks =
    useMemo(() => {
      const sortedTasks = [...tasks].sort(
        (a, b) => {
          const aOverdue = isTaskOverdue(a);
          const bOverdue = isTaskOverdue(b);

          if (aOverdue && !bOverdue) {
            return -1;
          }

          if (!aOverdue && bOverdue) {
            return 1;
          }

          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        }
      );

      if (filter === "all") {
        return sortedTasks;
      }

      if (filter === "overdue") {
        return sortedTasks.filter(
          (task) => isTaskOverdue(task)
        );
      }

      return sortedTasks.filter(
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

      submitted: tasks.filter(
        (task) =>
          task.status ===
          "submitted"
      ).length,

      overdue: tasks.filter(
        (task) =>
          isTaskOverdue(task)
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

    if (status === "submitted") {
      return "等待上級確認";
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

    if (status === "submitted") {
      return "border-violet-900/60 bg-violet-950/20 text-violet-300";
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
              任務區
            </h1>

            <p className="mt-3 text-neutral-400">
              處理收到的任務、追蹤提交狀態與完成紀錄。
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

        <section className="mb-6">
          <div className="mb-4">
            <p className="text-sm text-neutral-500">
              任務區總覽
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              現在需要處理的任務
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <button
              type="button"
              onClick={() =>
                setFilter(
                  counts.pending > 0
                    ? "pending"
                    : "accepted"
                )
              }
              className="rounded-2xl border border-amber-900/50 bg-amber-950/10 p-5 text-left transition hover:border-amber-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-amber-400">
                    需要我處理
                  </p>

                  <p className="mt-2 text-3xl font-semibold">
                    {counts.pending +
                      counts.accepted}
                  </p>
                </div>

                <span className="rounded-full border border-amber-900/60 px-3 py-1 text-xs text-amber-300">
                  待辦
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-neutral-950/70 p-3">
                  <p className="text-neutral-500">
                    待接受
                  </p>
                  <p className="mt-1 text-lg text-neutral-100">
                    {counts.pending}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950/70 p-3">
                  <p className="text-neutral-500">
                    進行中
                  </p>
                  <p className="mt-1 text-lg text-neutral-100">
                    {counts.accepted}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setFilter("submitted")
              }
              className="rounded-2xl border border-violet-900/60 bg-violet-950/15 p-5 text-left transition hover:border-violet-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-violet-400">
                    我已提交
                  </p>

                  <p className="mt-2 text-3xl font-semibold text-violet-200">
                    {counts.submitted}
                  </p>
                </div>

                <span className="rounded-full border border-violet-900/60 px-3 py-1 text-xs text-violet-300">
                  等待確認
                </span>
              </div>

              <p className="mt-5 text-sm leading-6 text-neutral-400">
                已提交完成，等待上級確認的任務。
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setFilter("completed")
              }
              className="rounded-2xl border border-emerald-900/50 bg-emerald-950/10 p-5 text-left transition hover:border-emerald-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-400">
                    已完成
                  </p>

                  <p className="mt-2 text-3xl font-semibold text-emerald-200">
                    {counts.completed}
                  </p>
                </div>

                <span className="rounded-full border border-emerald-900/60 px-3 py-1 text-xs text-emerald-300">
                  完成
                </span>
              </div>

              <p className="mt-5 text-sm leading-6 text-neutral-400">
                已經由上級確認完成的任務紀錄。
              </p>
            </button>
          </div>

          {counts.overdue > 0 && (
            <button
              type="button"
              onClick={() =>
                setFilter("overdue")
              }
              className="mt-4 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-900/60 bg-red-950/20 p-4 text-left transition hover:border-red-700"
            >
              <div>
                <p className="font-medium text-red-300">
                  有 {counts.overdue} 件任務已逾期
                </p>

                <p className="mt-1 text-sm text-red-400/80">
                  點此直接查看逾期任務。
                </p>
              </div>

              <span className="rounded-lg border border-red-800 px-3 py-1 text-sm text-red-300">
                查看逾期
              </span>
            </button>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-3">
            <p className="text-sm text-neutral-500">
              任務篩選
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["all", "全部"],
              ["pending", "待接受"],
              ["accepted", "進行中"],
              ["submitted", "待上級確認"],
              ["overdue", "已逾期"],
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

                  const overdue =
                    isTaskOverdue(task);

                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className={`block rounded-xl border p-5 transition ${
                        overdue
                          ? "border-red-900/60 bg-red-950/10 hover:border-red-700"
                          : "border-neutral-800 bg-neutral-950 hover:border-neutral-600 hover:bg-neutral-900"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-medium">
                            {task.title}
                          </p>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-400">
                            {task.content}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-1 text-xs font-medium text-emerald-300">
                              完成 +{task.reward_points}
                            </span>

                            <span className="rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-1 text-xs font-medium text-red-300">
                              逾期 -{task.penalty_points}
                            </span>

                            {task.penalty_applied_at && (
                              <span className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-1 text-xs font-medium text-red-200">
                                已扣點
                              </span>
                            )}
                          </div>

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
                              <span
                                className={
                                  overdue
                                    ? "font-medium text-red-400"
                                    : undefined
                                }
                              >
                                截止：
                                {formatDate(
                                  task.due_at
                                )}
                                {overdue &&
                                  "（已逾期）"}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            overdue
                              ? "border-red-900/60 bg-red-950/20 text-red-300"
                              : getStatusClass(
                                  task.status
                                )
                          }`}
                        >
                          {overdue
                            ? "已逾期"
                            : getStatusLabel(
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