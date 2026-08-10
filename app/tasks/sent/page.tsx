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

  const filteredTasks = useMemo(() => {
    if (filter === "all") {
      return tasks;
    }

    return tasks.filter(
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

        <section className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              等待接受
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {pendingCount} 件
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              進行中
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {acceptedCount} 件
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              已完成
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {completedCount} 件
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              已取消
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {cancelledCount} 件
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "全部"],
              ["pending", "等待接受"],
              ["accepted", "進行中"],
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
                ({ task, receiver }) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-xl bg-neutral-950 p-5 transition hover:bg-neutral-800"
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
                        className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
                          task.status
                        )}`}
                      >
                        {getStatusLabel(
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

                      <span>
                        期限：
                        {task.due_at
                          ? formatDate(
                              task.due_at
                            )
                          : "無期限"}
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
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}