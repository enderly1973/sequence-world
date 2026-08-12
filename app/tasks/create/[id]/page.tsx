"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabase";

type ReceiverProfile = {
  id: string;
  nickname: string;

  gender:
    | "female"
    | "male"
    | "other";

  join_sequence: number;
};

type WorldStatus = {
  world_points: number;

  maintenance_status:
    | "normal"
    | "insufficient"
    | "inactive"
    | "administrator";

  can_earn_points: boolean;

  can_spend_points: boolean;

  can_start_competition: boolean;

  can_send_task: boolean;

  status_message: string;
};

export default function CreateTaskPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const receiverId =
    params.id as string;

  const [
    receiver,
    setReceiver,
  ] =
    useState<
      ReceiverProfile | null
    >(null);

  const [
    worldStatus,
    setWorldStatus,
  ] =
    useState<
      WorldStatus | null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    content,
    setContent,
  ] =
    useState("");

  const [
    dueAt,
    setDueAt,
  ] =
    useState("");

  const [
    rewardPoints,
    setRewardPoints,
  ] =
    useState("0");

  const [
    penaltyPoints,
    setPenaltyPoints,
  ] =
    useState("0");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  useEffect(() => {
    void loadReceiver();
  }, [receiverId]);

  async function loadWorldStatus() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_my_world_status"
      );

    if (error) {
      throw error;
    }

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      const result =
        data[0];

      const status: WorldStatus =
        {
          world_points:
            Number(
              result.world_points ??
                0
            ),

          maintenance_status:
            result.maintenance_status,

          can_earn_points:
            Boolean(
              result.can_earn_points
            ),

          can_spend_points:
            Boolean(
              result.can_spend_points
            ),

          can_start_competition:
            Boolean(
              result.can_start_competition
            ),

          can_send_task:
            Boolean(
              result.can_send_task
            ),

          status_message:
            String(
              result.status_message ??
                ""
            ),
        };

      setWorldStatus(
        status
      );

      return status;
    }

    return null;
  }

  async function loadReceiver() {
    setLoading(true);

    setErrorMessage("");

    try {
      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth.getUser();

      if (
        userError
      ) {
        throw userError;
      }

      if (!user) {
        router.replace(
          "/login"
        );

        return;
      }

      await loadWorldStatus();

      const {
        data:
          relationData,
        error:
          relationError,
      } =
        await supabase
          .from(
            "hierarchy_relations"
          )
          .select(
            "subordinate_id"
          )
          .eq(
            "superior_id",
            user.id
          )
          .eq(
            "subordinate_id",
            receiverId
          )
          .eq(
            "status",
            "active"
          )
          .maybeSingle();

      if (
        relationError
      ) {
        throw relationError;
      }

      if (
        !relationData
      ) {
        throw new Error(
          "你目前不是這位成員的直接上級，無法發送任務。"
        );
      }

      const {
        data:
          receiverData,
        error:
          receiverError,
      } =
        await supabase
          .from(
            "profiles"
          )
          .select(`
            id,
            nickname,
            gender,
            join_sequence
          `)
          .eq(
            "id",
            receiverId
          )
          .single();

      if (
        receiverError
      ) {
        throw receiverError;
      }

      setReceiver(
        receiverData as ReceiverProfile
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "讀取任務接收者時發生錯誤。"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !receiver ||
      submitting
    ) {
      return;
    }

    setErrorMessage("");

    setSuccessMessage("");

    if (
      !worldStatus
        ?.can_send_task
    ) {
      setErrorMessage(
        "世界維持不足：你的世界積分已耗盡，目前無法主動發送任務。"
      );

      return;
    }

    setSubmitting(true);

    try {
      if (
        !title.trim()
      ) {
        throw new Error(
          "請輸入任務標題。"
        );
      }

      if (
        !content.trim()
      ) {
        throw new Error(
          "請輸入任務內容。"
        );
      }

      const parsedRewardPoints =
        Number.parseInt(
          rewardPoints || "0",
          10
        );

      const parsedPenaltyPoints =
        Number.parseInt(
          penaltyPoints || "0",
          10
        );

      if (
        Number.isNaN(
          parsedRewardPoints
        ) ||
        parsedRewardPoints < 0
      ) {
        throw new Error(
          "完成獎勵必須是 0 以上的整數。"
        );
      }

      if (
        Number.isNaN(
          parsedPenaltyPoints
        ) ||
        parsedPenaltyPoints < 0
      ) {
        throw new Error(
          "逾期懲罰必須是 0 以上的整數。"
        );
      }

      if (
        parsedRewardPoints > 0 &&
        parsedPenaltyPoints <
          parsedRewardPoints * 2
      ) {
        throw new Error(
          `逾期懲罰至少需為完成獎勵的 2 倍，目前至少需要 ${
            parsedRewardPoints * 2
          } 點。`
        );
      }

      // =========================
      // 發送前再次讀取最新世界狀態
      // =========================

      const latestStatus =
        await loadWorldStatus();

      if (
        !latestStatus
          ?.can_send_task
      ) {
        throw new Error(
          "世界維持不足：你的世界積分已耗盡，目前無法主動發送任務。"
        );
      }

      const parsedDueAt =
        dueAt
          ? new Date(
              dueAt
            ).toISOString()
          : null;

      const {
        error,
      } =
        await supabase.rpc(
          "create_task_for_subordinate",
          {
            p_receiver_id:
              receiver.id,

            p_title:
              title.trim(),

            p_content:
              content.trim(),

            p_due_at:
              parsedDueAt,

            p_reward_points:
              parsedRewardPoints,

            p_penalty_points:
              parsedPenaltyPoints,
          }
        );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "任務已成功發送。"
      );

      setTitle("");

      setContent("");

      setDueAt("");

      setRewardPoints("0");

      setPenaltyPoints("0");

      window.setTimeout(
        () => {
          router.push(
            "/subordinates"
          );

          router.refresh();
        },
        900
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "發送任務時發生錯誤。"
      );

      await loadWorldStatus();
    } finally {
      setSubmitting(
        false
      );
    }
  }

  function formatSequence(
    sequence: number
  ) {
    return String(
      sequence
    ).padStart(
      6,
      "0"
    );
  }

  function getGenderLabel(
    gender:
      ReceiverProfile["gender"]
  ) {
    if (
      gender ===
      "female"
    ) {
      return "女性";
    }

    if (
      gender ===
      "male"
    ) {
      return "男性";
    }

    return "其他";
  }

  const worldMaintenanceInsufficient =
    worldStatus
      ?.maintenance_status ===
    "insufficient";

  const canSendTask =
    Boolean(
      worldStatus
        ?.can_send_task
    );


  const rewardNumber =
    Number.parseInt(
      rewardPoints || "0",
      10
    ) || 0;

  const penaltyNumber =
    Number.parseInt(
      penaltyPoints || "0",
      10
    ) || 0;

  const minimumPenalty =
    rewardNumber > 0
      ? rewardNumber * 2
      : 0;

  const penaltyTooLow =
    rewardNumber > 0 &&
    penaltyNumber <
      minimumPenalty;

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取接收者資料…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">

      <div className="mx-auto max-w-3xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">

          <div>

            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              發送任務
            </h1>

            <p className="mt-3 text-neutral-400">
              對你的直接從屬者建立任務。
            </p>

          </div>

          <Link
            href="/subordinates"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            返回從屬者管理
          </Link>

        </header>

        {worldMaintenanceInsufficient && (
          <section className="mb-6 rounded-2xl border border-red-800 bg-red-950/30 p-6">

            <p className="text-sm font-medium text-red-400">
              WORLD MAINTENANCE WARNING
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-red-200">
              世界維持不足
            </h2>

            <p className="mt-3 leading-7 text-red-100/80">
              你的世界積分已耗盡，目前無法主動建立新的從屬者任務。
              世界積分恢復至 1 以上後，即可重新使用發送任務功能。
            </p>

            <div className="mt-5 flex flex-wrap gap-3">

              <Link
                href="/checkin"
                className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-950"
              >
                前往每日打卡
              </Link>

              <Link
                href="/daily-missions"
                className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-200 transition hover:border-red-500"
              >
                查看每日任務
              </Link>

            </div>

          </section>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {
              errorMessage
            }
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-emerald-300">
            {
              successMessage
            }
          </div>
        )}

        {receiver && (
          <>

            <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

              <p className="text-sm text-neutral-500">
                任務接收者
              </p>

              <div className="mt-4">

                <p className="text-xl font-medium">
                  {
                    receiver.nickname
                  }
                </p>

                <p className="mt-2 text-sm text-neutral-500">

                  序號{" "}

                  {formatSequence(
                    receiver.join_sequence
                  )}

                  ・

                  {getGenderLabel(
                    receiver.gender
                  )}

                </p>

              </div>

            </section>

            {!canSendTask ? (

              <section className="rounded-2xl border border-red-900/60 bg-red-950/10 p-6">

                <p className="text-sm text-red-400">
                  發送任務
                </p>

                <h2 className="mt-2 text-xl font-semibold text-red-200">
                  目前無法發送任務
                </h2>

                <p className="mt-3 leading-7 text-neutral-400">
                  世界積分恢復至 1 以上後，這裡會重新開放任務建立表單。
                </p>

                <div className="mt-5">

                  <Link
                    href="/subordinates"
                    className="inline-flex rounded-lg border border-neutral-700 px-5 py-3 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                  >
                    返回從屬者管理
                  </Link>

                </div>

              </section>

            ) : (

              <form
                onSubmit={
                  handleSubmit
                }
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
              >

                <div>

                  <label
                    htmlFor="title"
                    className="text-sm text-neutral-400"
                  >
                    任務標題
                  </label>

                  <input
                    id="title"
                    type="text"
                    value={
                      title
                    }
                    maxLength={
                      100
                    }
                    onChange={(
                      event
                    ) =>
                      setTitle(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="例如：完成指定任務"
                    className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition focus:border-neutral-500"
                  />

                  <p className="mt-2 text-right text-xs text-neutral-600">
                    {
                      title.length
                    }{" "}
                    / 100
                  </p>

                </div>

                <div className="mt-6">

                  <label
                    htmlFor="content"
                    className="text-sm text-neutral-400"
                  >
                    任務內容
                  </label>

                  <textarea
                    id="content"
                    value={
                      content
                    }
                    maxLength={
                      2000
                    }
                    rows={
                      8
                    }
                    onChange={(
                      event
                    ) =>
                      setContent(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="輸入任務要求、內容或完成條件。"
                    className="mt-2 w-full resize-none rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition focus:border-neutral-500"
                  />

                  <p className="mt-2 text-right text-xs text-neutral-600">
                    {
                      content.length
                    }{" "}
                    / 2000
                  </p>

                </div>

                <div className="mt-6">

                  <label
                    htmlFor="dueAt"
                    className="text-sm text-neutral-400"
                  >
                    完成期限
                  </label>

                  <input
                    id="dueAt"
                    type="datetime-local"
                    value={
                      dueAt
                    }
                    onChange={(
                      event
                    ) =>
                      setDueAt(
                        event
                          .target
                          .value
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition focus:border-neutral-500"
                  />

                  <p className="mt-2 text-xs text-neutral-600">
                    可不填，代表此任務目前沒有指定期限。
                  </p>

                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">

                  <div>

                    <label
                      htmlFor="rewardPoints"
                      className="text-sm text-neutral-400"
                    >
                      完成獎勵
                    </label>

                    <div className="mt-2 flex items-center rounded-lg border border-emerald-900/60 bg-emerald-950/10">

                      <input
                        id="rewardPoints"
                        type="number"
                        min="0"
                        step="1"
                        value={
                          rewardPoints
                        }
                        onChange={(
                          event
                        ) =>
                          setRewardPoints(
                            event.target.value
                          )
                        }
                        className="w-full bg-transparent px-4 py-3 text-neutral-100 outline-none"
                      />

                      <span className="pr-4 text-sm text-emerald-400">
                        世界點數
                      </span>

                    </div>

                    <p className="mt-2 text-xs text-neutral-600">
                      上級確認任務完成後，系統發放給接收者。
                    </p>

                  </div>

                  <div>

                    <label
                      htmlFor="penaltyPoints"
                      className="text-sm text-neutral-400"
                    >
                      逾期懲罰
                    </label>

                    <div className="mt-2 flex items-center rounded-lg border border-red-900/60 bg-red-950/10">

                      <input
                        id="penaltyPoints"
                        type="number"
                        min="0"
                        step="1"
                        value={
                          penaltyPoints
                        }
                        onChange={(
                          event
                        ) =>
                          setPenaltyPoints(
                            event.target.value
                          )
                        }
                        className="w-full bg-transparent px-4 py-3 text-neutral-100 outline-none"
                      />

                      <span className="pr-4 text-sm text-red-400">
                        世界點數
                      </span>

                    </div>

                    <p
                      className={`mt-2 text-xs ${
                        penaltyTooLow
                          ? "text-red-400"
                          : "text-neutral-600"
                      }`}
                    >
                      {rewardNumber > 0
                        ? `完成獎勵為 ${rewardNumber} 點時，逾期懲罰至少需 ${minimumPenalty} 點。`
                        : "完成獎勵為 0 時，逾期懲罰可自行設定。"}
                    </p>

                  </div>

                </div>

                <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-4">

                  <p className="text-sm text-neutral-400">
                    獎懲設定
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">

                    <span className="text-emerald-300">
                      完成 +{rewardNumber} 點
                    </span>

                    <span
                      className={
                        penaltyTooLow
                          ? "text-red-400"
                          : "text-red-300"
                      }
                    >
                      逾期 -{penaltyNumber} 點
                    </span>

                  </div>

                  {penaltyTooLow && (
                    <p className="mt-3 text-sm text-red-400">
                      逾期懲罰不足，目前至少需要 {minimumPenalty} 點。
                    </p>
                  )}

                </div>

                <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-neutral-800 pt-6">

                  <Link
                    href="/subordinates"
                    className="rounded-lg border border-neutral-700 px-5 py-3 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                  >
                    取消
                  </Link>

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      penaltyTooLow
                    }
                    className="rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? "發送中…"
                      : "確認發送任務"}
                  </button>

                </div>

              </form>

            )}

          </>
        )}

      </div>

    </main>
  );
}