"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

type ProfileSummary = {
  id: string;
  nickname: string;
  join_sequence: number;
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();

  const taskId = params.id as string;

  const [currentUserId, setCurrentUserId] = useState("");

  const [task, setTask] = useState<Task | null>(null);

  const [sender, setSender] =
    useState<ProfileSummary | null>(null);

  const [receiver, setReceiver] =
    useState<ProfileSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void loadTask();
  }, [taskId]);

  async function loadTask() {
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

      setCurrentUserId(user.id);

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
        .eq("id", taskId)
        .single();

      if (taskError) {
        throw taskError;
      }

      const loadedTask = taskData as Task;

      if (
        loadedTask.receiver_id !== user.id &&
        loadedTask.sender_id !== user.id
      ) {
        throw new Error(
          "你沒有權限查看這個任務。"
        );
      }

      setTask(loadedTask);

      const profileIds = [
        loadedTask.sender_id,
        loadedTask.receiver_id,
      ];

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
        .in("id", profileIds);

      if (profileError) {
        throw profileError;
      }

      const profiles =
        (profileData ?? []) as ProfileSummary[];

      setSender(
        profiles.find(
          (profile) =>
            profile.id === loadedTask.sender_id
        ) ?? null
      );

      setReceiver(
        profiles.find(
          (profile) =>
            profile.id === loadedTask.receiver_id
        ) ?? null
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

  async function handleAcceptTask() {
    if (!task || updating) {
      return;
    }

    setUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "accept_task",
        {
          p_task_id: task.id,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "任務已接受，現在進入進行中狀態。"
      );

      await loadTask();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "接受任務時發生錯誤。"
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleCompleteTask() {
    if (!task || updating) {
      return;
    }

    setUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "complete_task",
        {
          p_task_id: task.id,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "任務已完成。"
      );

      await loadTask();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "完成任務時發生錯誤。"
      );
    } finally {
      setUpdating(false);
    }
  }

  function formatSequence(sequence: number) {
    return String(sequence).padStart(6, "0");
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

  function getStatusLabel(status: TaskStatus) {
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

  function getStatusClass(status: TaskStatus) {
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

  const isReceiver =
    task?.receiver_id === currentUserId;

  const isSender =
    task?.sender_id === currentUserId;

  const isOverdue =
    Boolean(
      task?.due_at &&
      task.status !== "completed" &&
      task.status !== "cancelled" &&
      new Date(task.due_at).getTime() < Date.now()
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取任務…
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
              任務詳情
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            {isReceiver && (
              <Link
                href="/tasks"
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                返回我的任務
              </Link>
            )}

            {isSender && (
              <Link
                href="/subordinates"
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                返回從屬者管理
              </Link>
            )}

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

        {task && (
          <>
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-500">
                    任務
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold">
                    {task.title}
                  </h2>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-sm ${
                    isOverdue
                      ? "border-red-900 text-red-300"
                      : getStatusClass(task.status)
                  }`}
                >
                  {isOverdue
                    ? "已逾期"
                    : getStatusLabel(task.status)}
                </span>
              </div>

              <div className="mt-6 grid gap-4 border-t border-neutral-800 pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-neutral-500">
                    發送者
                  </p>

                  <p className="mt-2">
                    {sender
                      ? sender.nickname
                      : "未知成員"}
                  </p>

                  {sender && (
                    <p className="mt-1 text-sm text-neutral-500">
                      序號{" "}
                      {formatSequence(
                        sender.join_sequence
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-neutral-500">
                    接收者
                  </p>

                  <p className="mt-2">
                    {receiver
                      ? receiver.nickname
                      : "未知成員"}
                  </p>

                  {receiver && (
                    <p className="mt-1 text-sm text-neutral-500">
                      序號{" "}
                      {formatSequence(
                        receiver.join_sequence
                      )}
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <p className="text-sm text-neutral-500">
                任務內容
              </p>

              <p className="mt-4 whitespace-pre-wrap leading-7 text-neutral-200">
                {task.content}
              </p>
            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <p className="text-sm text-neutral-500">
                任務時間
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-4">
                  <span className="text-neutral-400">
                    發送時間
                  </span>

                  <span>
                    {formatDate(task.created_at)}
                  </span>
                </div>

                <div className="flex flex-wrap justify-between gap-4">
                  <span className="text-neutral-400">
                    完成期限
                  </span>

                  <span>
                    {task.due_at
                      ? formatDate(task.due_at)
                      : "無期限"}
                  </span>
                </div>

                {task.accepted_at && (
                  <div className="flex flex-wrap justify-between gap-4">
                    <span className="text-neutral-400">
                      接受時間
                    </span>

                    <span>
                      {formatDate(
                        task.accepted_at
                      )}
                    </span>
                  </div>
                )}

                {task.completed_at && (
                  <div className="flex flex-wrap justify-between gap-4">
                    <span className="text-neutral-400">
                      完成時間
                    </span>

                    <span>
                      {formatDate(
                        task.completed_at
                      )}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {isOverdue && (
              <section className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/20 p-6">
                <p className="text-sm font-medium text-red-400">
                  任務已逾期
                </p>

                <p className="mt-2 text-neutral-300">
                  此任務已超過完成期限，但仍可繼續接受、提交與確認完成。
                </p>
              </section>
            )}

            {isReceiver &&
              task.status === "pending" && (
                <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                  <p className="text-sm text-neutral-500">
                    任務操作
                  </p>

                  <h3 className="mt-2 text-xl font-medium">
                    接受任務
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    接受後，任務狀態會變成「進行中」。
                  </p>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={handleAcceptTask}
                    className="mt-5 rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updating
                      ? "處理中…"
                      : "接受任務"}
                  </button>
                </section>
              )}

            {isReceiver &&
              task.status === "accepted" && (
                <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                  <p className="text-sm text-neutral-500">
                    任務操作
                  </p>

                  <h3 className="mt-2 text-xl font-medium">
                    完成任務
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    完成後，任務將正式記錄為已完成。
                  </p>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={handleCompleteTask}
                    className="mt-5 rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updating
                      ? "處理中…"
                      : "完成任務"}
                  </button>
                </section>
              )}

            {task.status === "completed" && (
              <section className="mt-6 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-6">
                <p className="text-sm text-emerald-400">
                  任務已完成
                </p>

                <p className="mt-2 text-neutral-300">
                  此任務已完成並保留於任務紀錄中。
                </p>
              </section>
            )}

            {isSender &&
              task.status === "pending" && (
                <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                  <p className="text-sm text-neutral-500">
                    接收狀態
                  </p>

                  <p className="mt-2 text-neutral-300">
                    正在等待從屬者接受此任務。
                  </p>
                </section>
              )}

            {isSender &&
              task.status === "accepted" && (
                <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                  <p className="text-sm text-neutral-500">
                    接收狀態
                  </p>

                  <p className="mt-2 text-neutral-300">
                    從屬者已接受任務，目前正在進行中。
                  </p>
                </section>
              )}
          </>
        )}
      </div>
    </main>
  );
}