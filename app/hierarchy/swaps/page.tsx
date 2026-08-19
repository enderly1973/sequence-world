"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SwapRequest = {
  id: string;
  relation_id: string;
  requester_id: string;
  target_id: string;
  status:
    | "pending"
    | "accepted"
    | "rejected"
    | "cancelled";
  created_at: string;
  responded_at: string | null;
};

type ProfileSummary = {
  id: string;
  nickname: string;
  join_sequence: number;
};

type DisplaySwapRequest = {
  id: string;
  relationId: string;
  requesterId: string;
  targetId: string;
  status: SwapRequest["status"];
  createdAt: string;
  respondedAt: string | null;
  otherUser: ProfileSummary | null;
};

export default function HierarchySwapsPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [receivedRequests, setReceivedRequests] =
    useState<DisplaySwapRequest[]>([]);

  const [sentRequests, setSentRequests] =
    useState<DisplaySwapRequest[]>([]);

  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
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
        data: requestData,
        error: requestError,
      } = await supabase
        .from("hierarchy_swap_requests")
        .select(`
          id,
          relation_id,
          requester_id,
          target_id,
          status,
          created_at,
          responded_at
        `)
        .or(
          `requester_id.eq.${user.id},target_id.eq.${user.id}`
        )
        .order("created_at", {
          ascending: false,
        });

      if (requestError) {
        throw requestError;
      }

      const requests =
        (requestData ?? []) as SwapRequest[];

      if (requests.length === 0) {
        setReceivedRequests([]);
        setSentRequests([]);
        return;
      }

      const otherUserIds = Array.from(
        new Set(
          requests.map((request) =>
            request.requester_id === user.id
              ? request.target_id
              : request.requester_id
          )
        )
      );

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
        .in("id", otherUserIds);

      if (profileError) {
        throw profileError;
      }

      const profileMap = new Map(
        (
          (profileData ?? []) as ProfileSummary[]
        ).map((profile) => [
          profile.id,
          profile,
        ])
      );

      const displayRequests =
        requests.map((request) => {
          const otherUserId =
            request.requester_id === user.id
              ? request.target_id
              : request.requester_id;

          return {
            id: request.id,
            relationId: request.relation_id,
            requesterId: request.requester_id,
            targetId: request.target_id,
            status: request.status,
            createdAt: request.created_at,
            respondedAt: request.responded_at,
            otherUser:
              profileMap.get(otherUserId) ?? null,
          };
        });

      setReceivedRequests(
        displayRequests.filter(
          (request) =>
            request.targetId === user.id
        )
      );

      setSentRequests(
        displayRequests.filter(
          (request) =>
            request.requesterId === user.id
        )
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取地位交換申請時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(
    request: DisplaySwapRequest
  ) {
    if (
      processingId ||
      request.status !== "pending"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `確定接受「${request.otherUser?.nickname ?? "對方"}」的地位交換申請嗎？\n\n接受後，你們目前的主人與從屬者身分會互換。`
      );

    if (!confirmed) {
      return;
    }

    setProcessingId(request.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "accept_hierarchy_swap",
        {
          p_request_id: request.id,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "已接受地位交換申請。"
      );

      await loadRequests();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "接受地位交換申請時發生錯誤。"
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(
    request: DisplaySwapRequest
  ) {
    if (
      processingId ||
      request.status !== "pending"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `確定拒絕「${request.otherUser?.nickname ?? "對方"}」的地位交換申請嗎？`
      );

    if (!confirmed) {
      return;
    }

    setProcessingId(request.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "reject_hierarchy_swap",
        {
          p_request_id: request.id,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "已拒絕地位交換申請。"
      );

      await loadRequests();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "拒絕地位交換申請時發生錯誤。"
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel(
    request: DisplaySwapRequest
  ) {
    if (
      processingId ||
      request.status !== "pending"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `確定取消對「${request.otherUser?.nickname ?? "對方"}」提出的地位交換申請嗎？`
      );

    if (!confirmed) {
      return;
    }

    setProcessingId(request.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "cancel_hierarchy_swap",
        {
          p_request_id: request.id,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "已取消地位交換申請。"
      );

      await loadRequests();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "取消地位交換申請時發生錯誤。"
      );
    } finally {
      setProcessingId(null);
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
    dateString: string
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
    ).format(new Date(dateString));
  }

  function getStatusLabel(
    status: SwapRequest["status"]
  ) {
    if (status === "pending") {
      return "等待處理";
    }

    if (status === "accepted") {
      return "已接受";
    }

    if (status === "rejected") {
      return "已拒絕";
    }

    return "已取消";
  }

  function renderRequestCard(
    request: DisplaySwapRequest,
    type: "received" | "sent"
  ) {
    return (
      <article
        key={request.id}
        className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-lg font-medium">
              {request.otherUser
                ? request.otherUser.nickname
                : "未知使用者"}
            </p>

            {request.otherUser && (
              <p className="mt-2 text-sm text-neutral-500">
                序號{" "}
                {formatSequence(
                  request.otherUser.join_sequence
                )}
              </p>
            )}
          </div>

          <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
            {getStatusLabel(
              request.status
            )}
          </span>
        </div>

        <p className="mt-4 text-sm text-neutral-500">
          {type === "received"
            ? "收到申請："
            : "提出申請："}
          {formatDate(
            request.createdAt
          )}
        </p>

        {request.respondedAt && (
          <p className="mt-2 text-sm text-neutral-500">
            處理時間：
            {formatDate(
              request.respondedAt
            )}
          </p>
        )}

        {request.status === "pending" && (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-neutral-800 pt-4">
            {type === "received" ? (
              <>
                <button
                  type="button"
                  disabled={
                    processingId !== null
                  }
                  onClick={() =>
                    void handleAccept(
                      request
                    )
                  }
                  className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processingId ===
                  request.id
                    ? "處理中…"
                    : "接受"}
                </button>

                <button
                  type="button"
                  disabled={
                    processingId !== null
                  }
                  onClick={() =>
                    void handleReject(
                      request
                    )
                  }
                  className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 transition hover:border-red-700 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  拒絕
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={
                  processingId !== null
                }
                onClick={() =>
                  void handleCancel(
                    request
                  )
                }
                className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 transition hover:border-red-700 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingId ===
                request.id
                  ? "處理中…"
                  : "取消申請"}
              </button>
            )}
          </div>
        )}
      </article>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取交換申請…
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
              地位交換申請
            </h1>

            <p className="mt-3 text-neutral-400">
              查看收到與送出的主人／從屬者地位交換申請。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/hierarchy"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回階級關係
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

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-emerald-300">
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-500">
                收到的申請
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                {
                  receivedRequests.filter(
                    (request) =>
                      request.status ===
                      "pending"
                  ).length
                }{" "}
                筆待處理
              </h2>
            </div>
          </div>

          {receivedRequests.length ===
          0 ? (
            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有收到地位交換申請。
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {receivedRequests.map(
                (request) =>
                  renderRequestCard(
                    request,
                    "received"
                  )
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-500">
                我送出的申請
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                {
                  sentRequests.filter(
                    (request) =>
                      request.status ===
                      "pending"
                  ).length
                }{" "}
                筆等待回覆
              </h2>
            </div>
          </div>

          {sentRequests.length ===
          0 ? (
            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有送出的地位交換申請。
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {sentRequests.map(
                (request) =>
                  renderRequestCard(
                    request,
                    "sent"
                  )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}