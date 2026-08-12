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

type TaskRow = {
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

type ProfileSummary = {
  id: string;
  nickname: string;
  join_sequence: number;
};

type TaskItem = {
  task: TaskRow;
  sender: ProfileSummary | null;
  receiver: ProfileSummary | null;
};

type FilterType =
  | "all"
  | "pending"
  | "accepted"
  | "submitted"
  | "overdue"
  | "completed"
  | "cancelled";

export default function AdminTasksPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

      const {
        data: me,
        error: meError,
      } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (meError) {
        throw meError;
      }

      const role = String(me?.role ?? "");

      if (
        role !== "founder" &&
        role !== "administrator"
      ) {
        router.replace("/dashboard");
        return;
      }

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
        .order("created_at", {
          ascending: false,
        });

      if (taskError) {
        throw taskError;
      }

      const rows =
        (taskData ?? []) as TaskRow[];

      if (rows.length === 0) {
        setTasks([]);
        return;
      }

      const ids = Array.from(
        new Set(
          rows.flatMap((task) => [
            task.sender_id,
            task.receiver_id,
          ])
        )
      );

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, nickname, join_sequence"
        )
        .in("id", ids);

      if (profileError) {
        throw profileError;
      }

      const profileMap = new Map(
        (
          (profileData ??
            []) as ProfileSummary[]
        ).map((profile) => [
          profile.id,
          profile,
        ])
      );

      setTasks(
        rows.map((task) => ({
          task,
          sender:
            profileMap.get(
              task.sender_id
            ) ?? null,
          receiver:
            profileMap.get(
              task.receiver_id
            ) ?? null,
        }))
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取管理者任務資料時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  function isTaskOverdue(task: TaskRow) {
    return Boolean(
      task.due_at &&
        task.status !== "completed" &&
        task.status !== "cancelled" &&
        new Date(task.due_at).getTime() <
          Date.now()
    );
  }

  const counts = useMemo(
    () => ({
      all: tasks.length,

      pending: tasks.filter(
        (item) =>
          item.task.status === "pending"
      ).length,

      accepted: tasks.filter(
        (item) =>
          item.task.status === "accepted"
      ).length,

      submitted: tasks.filter(
        (item) =>
          item.task.status === "submitted"
      ).length,

      overdue: tasks.filter(
        (item) =>
          isTaskOverdue(item.task)
      ).length,

      completed: tasks.filter(
        (item) =>
          item.task.status === "completed"
      ).length,

      cancelled: tasks.filter(
        (item) =>
          item.task.status === "cancelled"
      ).length,
    }),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const sorted = [...tasks].sort(
      (a, b) => {
        const aSubmitted =
          a.task.status === "submitted";

        const bSubmitted =
          b.task.status === "submitted";

        if (
          aSubmitted &&
          !bSubmitted
        ) {
          return -1;
        }

        if (
          !aSubmitted &&
          bSubmitted
        ) {
          return 1;
        }

        const aOverdue =
          isTaskOverdue(a.task);

        const bOverdue =
          isTaskOverdue(b.task);

        if (
          aOverdue &&
          !bOverdue
        ) {
          return -1;
        }

        if (
          !aOverdue &&
          bOverdue
        ) {
          return 1;
        }

        return (
          new Date(
            b.task.created_at
          ).getTime() -
          new Date(
            a.task.created_at
          ).getTime()
        );
      }
    );

    if (filter === "all") {
      return sorted;
    }

    if (filter === "overdue") {
      return sorted.filter(
        (item) =>
          isTaskOverdue(
            item.task
          )
      );
    }

    return sorted.filter(
      (item) =>
        item.task.status === filter
    );
  }, [tasks, filter]);

  function formatSequence(
    sequence: number
  ) {
    return String(sequence).padStart(
      6,
      "0"
    );
  }

  function formatDate(
    value: string | null
  ) {
    if (!value) {
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
    ).format(new Date(value));
  }

  function getStatusLabel(
    status: TaskStatus
  ) {
    if (status === "pending") {
      return "等待接受";
    }

    if (status === "accepted") {
      return "進行中";
    }

    if (status === "submitted") {
      return "待確認";
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
      return "border-amber-900 text-amber-300";
    }

    if (status === "accepted") {
      return "border-blue-900 text-blue-300";
    }

    if (status === "submitted") {
      return "border-violet-900 text-violet-300";
    }

    if (status === "completed") {
      return "border-emerald-900 text-emerald-300";
    }

    return "border-neutral-700 text-neutral-500";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取管理者任務…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD ADMIN
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              任務管理
            </h1>

            <p className="mt-3 text-neutral-400">
              查看所有玩家任務與任務證明。此頁僅供管理者檢視。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回管理中心
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

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              全部任務
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {counts.all}
            </p>
          </div>

          <div className="rounded-2xl border border-violet-900/60 bg-violet-950/20 p-5">
            <p className="text-sm text-violet-400">
              待確認
            </p>

            <p className="mt-2 text-3xl font-semibold text-violet-300">
              {counts.submitted}
            </p>
          </div>

          <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-5">
            <p className="text-sm text-red-400">
              已逾期
            </p>

            <p className="mt-2 text-3xl font-semibold text-red-300">
              {counts.overdue}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-5">
            <p className="text-sm text-emerald-400">
              已完成
            </p>

            <p className="mt-2 text-3xl font-semibold text-emerald-300">
              {counts.completed}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-wrap gap-2">
            {[
              [
                "all",
                `全部 ${counts.all}`,
              ],
              [
                "pending",
                `等待接受 ${counts.pending}`,
              ],
              [
                "accepted",
                `進行中 ${counts.accepted}`,
              ],
              [
                "submitted",
                `待確認 ${counts.submitted}`,
              ],
              [
                "overdue",
                `已逾期 ${counts.overdue}`,
              ],
              [
                "completed",
                `已完成 ${counts.completed}`,
              ],
              [
                "cancelled",
                `已取消 ${counts.cancelled}`,
              ],
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
                ({
                  task,
                  sender,
                  receiver,
                }) => {
                  const overdue =
                    isTaskOverdue(task);

                  return (
                    <Link
                      key={task.id}
                      href={`/admin/tasks/${task.id}`}
                      className={`block rounded-xl border p-5 transition ${
                        task.status ===
                        "submitted"
                          ? "border-violet-900/60 bg-violet-950/10 hover:border-violet-700"
                          : overdue
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

                          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
                            <span>
                              發送者：
                              {sender
                                ? `${sender.nickname}・${formatSequence(
                                    sender.join_sequence
                                  )}`
                                : "未知成員"}
                            </span>

                            <span>
                              接收者：
                              {receiver
                                ? `${receiver.nickname}・${formatSequence(
                                    receiver.join_sequence
                                  )}`
                                : "未知成員"}
                            </span>

                            <span>
                              建立：
                              {formatDate(
                                task.created_at
                              )}
                            </span>

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
                          </div>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            overdue
                              ? "border-red-900 text-red-300"
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