"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

type ProfileSummary = {
  id: string;
  nickname: string;
  join_sequence: number;
};

type TaskAttachment = {
  id: string;
  task_id: string;
  uploader_id: string;
  file_path: string;
  file_type: "image" | "video";
  created_at: string;
  signed_url: string | null;
};

export default function AdminTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [sender, setSender] =
    useState<ProfileSummary | null>(null);
  const [receiver, setReceiver] =
    useState<ProfileSummary | null>(null);
  const [attachments, setAttachments] =
    useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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
        .eq("id", taskId)
        .single();

      if (taskError) {
        throw taskError;
      }

      const loadedTask = taskData as Task;

      setTask(loadedTask);

      const [
        profileResult,
        attachmentResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(`
            id,
            nickname,
            join_sequence
          `)
          .in("id", [
            loadedTask.sender_id,
            loadedTask.receiver_id,
          ]),

        supabase
          .from("task_attachments")
          .select(`
            id,
            task_id,
            uploader_id,
            file_path,
            file_type,
            created_at
          `)
          .eq("task_id", taskId)
          .order("created_at", {
            ascending: true,
          }),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (attachmentResult.error) {
        throw attachmentResult.error;
      }

      const profiles =
        (profileResult.data ??
          []) as ProfileSummary[];

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

      const rows =
        (attachmentResult.data ?? []) as Omit<
          TaskAttachment,
          "signed_url"
        >[];

      const signed =
        await Promise.all(
          rows.map(
            async (attachment) => {
              const {
                data,
                error,
              } = await supabase.storage
                .from("task-evidence")
                .createSignedUrl(
                  attachment.file_path,
                  60 * 60
                );

              if (error) {
                console.error(
                  "建立管理者附件網址失敗:",
                  error
                );
              }

              return {
                ...attachment,
                signed_url:
                  data?.signedUrl ?? null,
              };
            }
          )
        );

      setAttachments(signed);
    } catch (error) {
  

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    setErrorMessage(
      String(
        (error as { message?: unknown }).message ??
          "未知錯誤"
      )
    );
  } else {
    setErrorMessage(
      "讀取管理者任務詳情時發生錯誤。"
    );
  }
}
    finally {
      setLoading(false);
    }
  }

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
      return "待上級確認";
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

  const isOverdue = Boolean(
    task?.due_at &&
      task.status !== "completed" &&
      task.status !== "cancelled" &&
      new Date(task.due_at).getTime() <
        Date.now()
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取任務詳情…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD ADMIN
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              任務詳情
            </h1>

            <p className="mt-3 text-neutral-400">
              管理者唯讀檢視。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/tasks"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回任務管理
            </Link>

            <Link
              href="/admin"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回管理中心
            </Link>
          </div>
        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {task && (
          <>
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <div className="flex flex-wrap items-start justify-between gap-5">
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
                      : getStatusClass(
                          task.status
                        )
                  }`}
                >
                  {isOverdue
                    ? "已逾期"
                    : getStatusLabel(
                        task.status
                      )}
                </span>
              </div>

              <div className="mt-6 grid gap-4 border-t border-neutral-800 pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-neutral-500">
                    發送者
                  </p>

                  <p className="mt-2">
                    {sender?.nickname ??
                      "未知成員"}
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
                    {receiver?.nickname ??
                      "未知成員"}
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
                任務獎懲
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
                  <p className="text-sm text-emerald-400">
                    完成獎勵
                  </p>

                  <p className="mt-2 text-xl font-semibold text-emerald-200">
                    +{task.reward_points} 世界點數
                  </p>
                </div>

                <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">
                  <p className="text-sm text-red-400">
                    逾期懲罰
                  </p>

                  <p className="mt-2 text-xl font-semibold text-red-200">
                    -{task.penalty_points} 世界點數
                  </p>
                </div>
              </div>

              {task.penalty_applied_at && (
                <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 p-4">
                  <p className="text-sm text-red-300">
                    逾期懲罰已執行
                  </p>

                  <p className="mt-2 text-lg font-semibold text-red-200">
                    已扣除{" "}
                    {task.penalty_points}{" "}
                    世界點數
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    扣點時間：
                    {formatDate(
                      task.penalty_applied_at
                    )}
                  </p>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <p className="text-sm text-neutral-500">
                任務證明
              </p>

              <h3 className="mt-2 text-xl font-medium">
                照片與影片
              </h3>

              <p className="mt-2 text-sm text-neutral-400">
                管理者可查看全部任務證明，但不能在此新增、刪除或修改。
              </p>

              {attachments.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-500">
                  此任務沒有上傳證明。
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {attachments.map(
                    (attachment) => (
                      <article
                        key={attachment.id}
                        className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                      >
                        <div className="aspect-video bg-black">
                          {attachment.signed_url ? (
                            attachment.file_type ===
                            "image" ? (
                              <img
                                src={attachment.signed_url}
                                alt="任務證明"
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <video
                                src={attachment.signed_url}
                                controls
                                preload="metadata"
                                className="h-full w-full object-contain"
                              />
                            )
                          ) : (
                            <div className="flex h-full items-center justify-center p-4 text-sm text-neutral-500">
                              無法載入附件預覽。
                            </div>
                          )}
                        </div>

                        <div className="p-4">
                          <p className="text-sm text-neutral-300">
                            {attachment.file_type ===
                            "image"
                              ? "照片"
                              : "影片"}
                          </p>

                          <p className="mt-1 text-xs text-neutral-600">
                            上傳時間：
                            {formatDate(
                              attachment.created_at
                            )}
                          </p>
                        </div>
                      </article>
                    )
                  )}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <p className="text-sm text-neutral-500">
                任務時間
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-4">
                  <span className="text-neutral-400">
                    建立時間
                  </span>

                  <span>
                    {formatDate(
                      task.created_at
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap justify-between gap-4">
                  <span className="text-neutral-400">
                    完成期限
                  </span>

                  <span
                    className={
                      isOverdue
                        ? "text-red-300"
                        : undefined
                    }
                  >
                    {formatDate(
                      task.due_at
                    )}

                    {isOverdue &&
                      "（已逾期）"}
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

                {task.cancelled_at && (
                  <div className="flex flex-wrap justify-between gap-4">
                    <span className="text-neutral-400">
                      取消時間
                    </span>

                    <span>
                      {formatDate(
                        task.cancelled_at
                      )}
                    </span>
                  </div>
                )}

                {task.penalty_applied_at && (
                  <div className="flex flex-wrap justify-between gap-4">
                    <span className="text-neutral-400">
                      逾期扣點時間
                    </span>

                    <span className="text-red-300">
                      {formatDate(
                        task.penalty_applied_at
                      )}
                    </span>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}