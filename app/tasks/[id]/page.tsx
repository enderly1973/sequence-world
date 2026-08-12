"use client";

import { ChangeEvent, useEffect, useState } from "react";
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

const MAX_FILE_SIZE = 50 * 1024 * 1024;

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

  const [attachments, setAttachments] =
    useState<TaskAttachment[]>([]);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] =
    useState<string | null>(null);

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
        throw new Error("你沒有權限查看這個任務。");
      }

      setTask(loadedTask);

      const profileIds = [
        loadedTask.sender_id,
        loadedTask.receiver_id,
      ];

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
          .in("id", profileIds),

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
        (profileResult.data ?? []) as ProfileSummary[];

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

      const attachmentRows =
        (attachmentResult.data ?? []) as Omit<
          TaskAttachment,
          "signed_url"
        >[];

      const signedAttachments =
        await Promise.all(
          attachmentRows.map(
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
                  "建立附件網址失敗:",
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

      setAttachments(signedAttachments);
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

  async function handleSubmitTask() {
    if (!task || updating) {
      return;
    }

    const confirmed = window.confirm(
      attachments.length > 0
        ? `確定要提交完成嗎？\n\n目前已附上 ${attachments.length} 個任務證明。提交後將無法再新增或刪除附件，需等待上級確認。`
        : "目前沒有上傳任何任務證明。\n\n確定仍要提交完成嗎？提交後將無法再新增附件，需等待上級確認。"
    );

    if (!confirmed) {
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
        "任務已提交完成，正在等待上級確認。"
      );

      await loadTask();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "提交任務時發生錯誤。"
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleConfirmCompletion() {
    if (!task || updating) {
      return;
    }

    const confirmed = window.confirm(
      "確定要確認此任務完成嗎？"
    );

    if (!confirmed) {
      return;
    }

    setUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "confirm_task_completion",
        {
          p_task_id: task.id,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "已確認任務完成。"
      );

      await loadTask();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "確認任務完成時發生錯誤。"
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    event.target.value = "";

    if (
      !task ||
      !currentUserId ||
      task.status !== "accepted" ||
      task.receiver_id !== currentUserId ||
      files.length === 0 ||
      uploading
    ) {
      return;
    }

    setUploading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `「${file.name}」超過 50 MB，請選擇較小的檔案。`
          );
        }

        const isImage =
          file.type.startsWith("image/");
        const isVideo =
          file.type.startsWith("video/");

        if (!isImage && !isVideo) {
          throw new Error(
            `「${file.name}」不是支援的照片或影片格式。`
          );
        }

        const fileType:
          | "image"
          | "video" = isImage
          ? "image"
          : "video";

        const extension =
          file.name.includes(".")
            ? file.name
                .split(".")
                .pop()
                ?.toLowerCase()
            : undefined;

        const uniqueName =
          `${crypto.randomUUID()}${
            extension
              ? `.${extension}`
              : ""
          }`;

        const filePath =
          `${task.id}/${currentUserId}/${uniqueName}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from("task-evidence")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        const {
          error: insertError,
        } = await supabase
          .from("task_attachments")
          .insert({
            task_id: task.id,
            uploader_id: currentUserId,
            file_path: filePath,
            file_type: fileType,
          });

        if (insertError) {
          await supabase.storage
            .from("task-evidence")
            .remove([filePath]);

          throw insertError;
        }
      }

      setSuccessMessage(
        files.length === 1
          ? "任務證明已上傳。"
          : `已上傳 ${files.length} 個任務證明。`
      );

      await loadTask();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "上傳任務證明時發生錯誤。"
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(
    attachment: TaskAttachment
  ) {
    if (
      !task ||
      task.status !== "accepted" ||
      task.receiver_id !== currentUserId ||
      attachment.uploader_id !== currentUserId ||
      deletingAttachmentId
    ) {
      return;
    }

    const confirmed = window.confirm(
      "確定要刪除這個任務證明嗎？"
    );

    if (!confirmed) {
      return;
    }

    setDeletingAttachmentId(
      attachment.id
    );
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error: storageError,
      } = await supabase.storage
        .from("task-evidence")
        .remove([attachment.file_path]);

      if (storageError) {
        throw storageError;
      }

      const {
        error: rowError,
      } = await supabase
        .from("task_attachments")
        .delete()
        .eq("id", attachment.id);

      if (rowError) {
        throw rowError;
      }

      setSuccessMessage(
        "任務證明已刪除。"
      );

      await loadTask();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "刪除任務證明時發生錯誤。"
      );
    } finally {
      setDeletingAttachmentId(null);
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

    if (status === "submitted") {
      return "等待上級確認";
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

    if (status === "submitted") {
      return "border-violet-900 text-violet-300";
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

  const isOverdue = Boolean(
    task?.due_at &&
      task.status !== "completed" &&
      task.status !== "cancelled" &&
      new Date(task.due_at).getTime() < Date.now()
  );

  const canManageEvidence =
    Boolean(
      task &&
        isReceiver &&
        task.status === "accepted"
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
                返回任務區
              </Link>
            )}

            {isSender && (
              <Link
                href="/tasks/sent"
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                返回發送任務
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-500">
                    任務證明
                  </p>

                  <h3 className="mt-2 text-xl font-medium">
                    照片與影片
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    {canManageEvidence
                      ? "可在提交完成前上傳或刪除照片、影片。單一檔案上限 50 MB。"
                      : "任務證明在提交後會保留，供雙方查看。"}
                  </p>
                </div>

                {canManageEvidence && (
                  <label className="cursor-pointer rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white">
                    {uploading
                      ? "上傳中…"
                      : "選擇照片／影片"}

                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      disabled={uploading}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {attachments.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-500">
                  目前沒有任務證明。
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

                        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                          <div>
                            <p className="text-sm text-neutral-300">
                              {attachment.file_type ===
                              "image"
                                ? "照片"
                                : "影片"}
                            </p>

                            <p className="mt-1 text-xs text-neutral-600">
                              {formatDate(
                                attachment.created_at
                              )}
                            </p>
                          </div>

                          {canManageEvidence &&
                            attachment.uploader_id ===
                              currentUserId && (
                              <button
                                type="button"
                                disabled={
                                  deletingAttachmentId ===
                                  attachment.id
                                }
                                onClick={() =>
                                  void handleDeleteAttachment(
                                    attachment
                                  )
                                }
                                className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 transition hover:border-red-700 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingAttachmentId ===
                                attachment.id
                                  ? "刪除中…"
                                  : "刪除"}
                              </button>
                            )}
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

                  <span
                    className={
                      isOverdue
                        ? "text-red-300"
                        : undefined
                    }
                  >
                    {task.due_at
                      ? formatDate(task.due_at)
                      : "無期限"}
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
                      確認完成時間
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
                    接受後，任務狀態會變成「進行中」，並可開始上傳任務證明。
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
                    提交完成
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    可先上傳照片或影片作為證明。提交後任務會進入「等待上級確認」，且附件將不能再新增或刪除。
                  </p>

                  <button
                    type="button"
                    disabled={
                      updating ||
                      uploading ||
                      deletingAttachmentId !== null
                    }
                    onClick={handleSubmitTask}
                    className="mt-5 rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updating
                      ? "提交中…"
                      : "提交完成"}
                  </button>
                </section>
              )}

            {isReceiver &&
              task.status === "submitted" && (
                <section className="mt-6 rounded-2xl border border-violet-900/50 bg-violet-950/20 p-6">
                  <p className="text-sm text-violet-400">
                    已提交完成
                  </p>

                  <p className="mt-2 text-neutral-300">
                    任務與證明已提交，正在等待上級確認。
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

            {isSender &&
              task.status === "submitted" && (
                <section className="mt-6 rounded-2xl border border-violet-800/60 bg-violet-950/20 p-6">
                  <p className="text-sm text-violet-400">
                    等待你確認
                  </p>

                  <h3 className="mt-2 text-xl font-medium">
                    從屬者已提交任務
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-neutral-300">
                    請先查看上方任務證明，確認內容後再完成任務。
                  </p>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={
                      handleConfirmCompletion
                    }
                    className="mt-5 rounded-lg bg-violet-100 px-5 py-3 text-sm font-medium text-violet-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updating
                      ? "確認中…"
                      : "確認完成"}
                  </button>
                </section>
              )}

            {task.status === "completed" && (
              <section className="mt-6 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-6">
                <p className="text-sm text-emerald-400">
                  任務已完成
                </p>

                <p className="mt-2 text-neutral-300">
                  此任務已由上級確認完成，任務證明會保留於紀錄中。
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
