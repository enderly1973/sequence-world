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

export default function SentTasksPage() {
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
        .eq("sender_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (taskError) {
        throw taskError;
      }

      const taskRows = (taskData ?? []) as TaskRow[];

      if (taskRows.length === 0) {
        setTasks([]);
        return;
      }

      const receiverIds = Array.from(
        new Set(
          taskRows.map(
            (task) => task.receiver_id
          )
        )
      );

      const {
        data: receiverData,
        error: receiverError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          nickname,
          join_sequence
        `)
        .in("id", receiverIds);

      if (receiverError) {
        throw receiverError;
      }

      const receiverMap = new Map(
        (
          (receiverData ?? []) as ProfileSummary[]
        ).map((receiver) => [
          receiver.id,
          receiver,
        ])
      );

      const result: TaskItem[] =
        taskRows.map((task) => ({
          task,
          receiver:
            receiverMap.get(
              task.receiver_id
            ) ?? null,
        }));

      setTasks(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取已發送任務時發生錯誤。"
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
      new Date(task.due_at).getTime() < Date.now()
    );
  }

  const filteredTasks = useMemo(() => {
    const sortedTasks = [...tasks].sort(
      (a, b) => {
        const aSubmitted =
          a.task.status === "submitted";
        const bSubmitted =
          b.task.status === "submitted";

        if (aSubmitted && !bSubmitted) {
          return -1;
        }

        if (!aSubmitted && bSubmitted) {
          return 1;
        }

        const aOverdue =
          isTaskOverdue(a.task);
        const bOverdue =
          isTaskOverdue(b.task);

        if (aOverdue && !bOverdue) {
          return -1;
        }

        if (!aOverdue && bOverdue) {
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
      return sortedTasks;
    }

    if (filter === "overdue") {
      return sortedTasks.filter(
        (item) =>
          isTaskOverdue(
            item.task
          )
      );
    }

    return sortedTasks.filter(
      (item) =>
        item.task.status === filter
    );
  }, [tasks, filter]);

  function formatSequence(sequence: number) {
    return String(sequence).padStart(
      6,
      "0"
    );
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(new Date(dateString));
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
      return "待你確認";
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

  const pendingCount = tasks.filter(
    (item) =>
      item.task.status === "pending"
  ).length;

  const acceptedCount = tasks.filter(
    (item) =>
      item.task.status === "accepted"
  ).length;

  const submittedCount = tasks.filter(
    (item) =>
      item.task.status === "submitted"
  ).length;

  const overdueCount = tasks.filter(
    (item) =>
      isTaskOverdue(
        item.task
      )
  ).length;

  const completedCount = tasks.filter(
    (item) =>
      item.task.status === "completed"
  ).length;

  const cancelledCount = tasks.filter(
    (item) =>
      item.task.status === "cancelled"
  ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取已發送任務…
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
              我發出的任務
            </h1>

            <p className="mt-3 text-neutral-400">
              查看你發送給直接從屬者的任務與目前狀態。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/tasks"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              我的任務
            </Link>

            <Link
              href="/subordinates"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              從屬者管理
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
              發送任務總覽
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              目前需要追蹤的任務
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <button
              type="button"
              onClick={() =>
                setFilter(
                  pendingCount > 0
                    ? "pending"
                    : "accepted"
                )
              }
              className="rounded-2xl border border-amber-900/50 bg-amber-950/10 p-5 text-left transition hover:border-amber-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-amber-400">
                    等待對方處理
                  </p>

                  <p className="mt-2 text-3xl font-semibold">
                    {pendingCount + acceptedCount}
                  </p>
                </div>

                <span className="rounded-full border border-amber-900/60 px-3 py-1 text-xs text-amber-300">
                  追蹤中
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-neutral-950/70 p-3">
                  <p className="text-neutral-500">
                    等待接受
                  </p>
                  <p className="mt-1 text-lg text-neutral-100">
                    {pendingCount}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950/70 p-3">
                  <p className="text-neutral-500">
                    進行中
                  </p>
                  <p className="mt-1 text-lg text-neutral-100">
                    {acceptedCount}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setFilter("submitted")
              }
              className="rounded-2xl border border-violet-800/70 bg-violet-950/20 p-5 text-left transition hover:border-violet-600"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-violet-300">
                    等待我確認
                  </p>

                  <p className="mt-2 text-3xl font-semibold text-violet-200">
                    {submittedCount}
                  </p>
                </div>

                <span className="rounded-full border border-violet-800 px-3 py-1 text-xs text-violet-300">
                  需要處理
                </span>
              </div>

              <p className="mt-5 text-sm leading-6 text-neutral-400">
                從屬者已提交完成，等待你確認的任務。
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                setFilter(
                  completedCount > 0
                    ? "completed"
                    : "cancelled"
                )
              }
              className="rounded-2xl border border-emerald-900/50 bg-emerald-950/10 p-5 text-left transition hover:border-emerald-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-400">
                    已結束
                  </p>

                  <p className="mt-2 text-3xl font-semibold text-emerald-200">
                    {completedCount + cancelledCount}
                  </p>
                </div>

                <span className="rounded-full border border-emerald-900/60 px-3 py-1 text-xs text-emerald-300">
                  紀錄
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-neutral-950/70 p-3">
                  <p className="text-neutral-500">
                    已完成
                  </p>
                  <p className="mt-1 text-lg text-neutral-100">
                    {completedCount}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950/70 p-3">
                  <p className="text-neutral-500">
                    已取消
                  </p>
                  <p className="mt-1 text-lg text-neutral-100">
                    {cancelledCount}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {overdueCount > 0 && (
            <button
              type="button"
              onClick={() =>
                setFilter("overdue")
              }
              className="mt-4 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-900/60 bg-red-950/20 p-4 text-left transition hover:border-red-700"
            >
              <div>
                <p className="font-medium text-red-300">
                  有 {overdueCount} 件發送任務已逾期
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
              ["pending", "等待接受"],
              ["accepted", "進行中"],
              ["submitted", "待你確認"],
              ["overdue", "已逾期"],
              ["completed", "已完成"],
              ["cancelled", "已取消"],
            ].map(([value, label]) => (
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
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          {filteredTasks.length === 0 ? (
            <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有符合條件的已發送任務。
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map(
                ({ task, receiver }) => {
                  const overdue =
                    isTaskOverdue(task);

                  return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className={`block rounded-xl border p-5 transition ${
                      task.status === "submitted"
                        ? "border-violet-900/60 bg-violet-950/10 hover:border-violet-700"
                        : overdue
                          ? "border-red-900/60 bg-red-950/10 hover:border-red-700"
                          : "border-neutral-800 bg-neutral-950 hover:bg-neutral-800"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-medium">
                          {task.title}
                        </p>

                        <p className="mt-2 text-sm text-neutral-500">
                          接收者：
                          {receiver
                            ? `${receiver.nickname}・${formatSequence(
                                receiver.join_sequence
                              )}`
                            : "未知成員"}
                        </p>
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

                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-neutral-400">
                      {task.content}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-neutral-800 pt-4 text-xs text-neutral-600">
                      <span>
                        發送時間：
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
                        期限：
                        {task.due_at
                          ? formatDate(
                              task.due_at
                            )
                          : "無期限"}
                        {overdue &&
                          "（已逾期）"}
                      </span>

                      {task.accepted_at && (
                        <span>
                          接受：
                          {formatDate(
                            task.accepted_at
                          )}
                        </span>
                      )}

                      {task.completed_at && (
                        <span>
                          完成：
                          {formatDate(
                            task.completed_at
                          )}
                        </span>
                      )}
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