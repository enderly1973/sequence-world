"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProfileSummary = {
  id: string;
  nickname: string;
  gender: "female" | "male" | "other";
  join_sequence: number;
};

type RequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

type RequestRow = {
  id: string;
  requester_id: string;
  target_id: string;
  request_type: "voluntary_subordination";
  status: RequestStatus;
  message: string | null;
  created_at: string;
  responded_at: string | null;
};

type RequestDisplay = {
  request: RequestRow;
  otherProfile: ProfileSummary;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const supabaseError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      supabaseError.message,
      supabaseError.details,
      supabaseError.hint,
      supabaseError.code
        ? `錯誤代碼：${supabaseError.code}`
        : null,
    ].filter(
      (item): item is string =>
        typeof item === "string" && item.length > 0
    );

    if (parts.length > 0) {
      return parts.join("｜");
    }
  }

  return fallback;
}

export default function RequestsPage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] =
    useState<ProfileSummary | null>(null);

  const [candidates, setCandidates] =
    useState<ProfileSummary[]>([]);

  const [sentRequests, setSentRequests] =
    useState<RequestDisplay[]>([]);

  const [receivedRequests, setReceivedRequests] =
    useState<RequestDisplay[]>([]);

  const [selectedTargetId, setSelectedTargetId] =
    useState("");

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void loadPage();
  }, []);

  async function loadPage() {
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
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, nickname, gender, join_sequence"
        )
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const profile = profileData as ProfileSummary;

      setCurrentProfile(profile);

      // =========================================
      // 候選名單
      //
      // 一般：
      // 比自己晚加入的人
      //
      // 女性：
      // 額外可以選所有男性
      // =========================================

      const {
        data: allProfiles,
        error: allProfilesError,
      } = await supabase
        .from("profiles")
        .select(
          "id, nickname, gender, join_sequence"
        )
        .eq("status", "active")
        .neq("id", profile.id)
        .order("join_sequence", {
          ascending: true,
        });

      if (allProfilesError) {
        throw allProfilesError;
      }

      const filteredCandidates = (
        (allProfiles ?? []) as ProfileSummary[]
      ).filter((candidate) => {
        // 一般規則：
        // 可以申請比自己晚加入的人
        if (
          candidate.join_sequence >
          profile.join_sequence
        ) {
          return true;
        }

        // 女性特殊規則：
        // 女性可以主動申請任何男性
        if (
          profile.gender === "female" &&
          candidate.gender === "male"
        ) {
          return true;
        }

        return false;
      });

      setCandidates(filteredCandidates);

      // =========================================
      // 讀取申請紀錄
      // =========================================

      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from("relation_requests")
        .select(`
          id,
          requester_id,
          target_id,
          request_type,
          status,
          message,
          created_at,
          responded_at
        `)
        .eq(
          "request_type",
          "voluntary_subordination"
        )
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
        (requestData ?? []) as RequestRow[];

      const relatedProfileIds = Array.from(
        new Set(
          requests.map((request) =>
            request.requester_id === user.id
              ? request.target_id
              : request.requester_id
          )
        )
      );

      let profileMap = new Map<
        string,
        ProfileSummary
      >();

      if (relatedProfileIds.length > 0) {
        const {
          data: relatedProfiles,
          error: relatedProfilesError,
        } = await supabase
          .from("profiles")
          .select(
            "id, nickname, gender, join_sequence"
          )
          .in("id", relatedProfileIds);

        if (relatedProfilesError) {
          throw relatedProfilesError;
        }

        profileMap = new Map(
          (
            (relatedProfiles ??
              []) as ProfileSummary[]
          ).map((item) => [item.id, item])
        );
      }

      const sent: RequestDisplay[] = [];
      const received: RequestDisplay[] = [];

      for (const request of requests) {
        if (request.requester_id === user.id) {
          const targetProfile =
            profileMap.get(request.target_id);

          if (targetProfile) {
            sent.push({
              request,
              otherProfile: targetProfile,
            });
          }
        }

        if (request.target_id === user.id) {
          const requesterProfile =
            profileMap.get(
              request.requester_id
            );

          if (requesterProfile) {
            received.push({
              request,
              otherProfile:
                requesterProfile,
            });
          }
        }
      }

      setSentRequests(sent);
      setReceivedRequests(received);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "讀取申請資料時發生錯誤。"
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRequest() {
    if (!selectedTargetId) {
      setErrorMessage(
        "請先選擇申請對象。"
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "create_voluntary_subordination_request",
        {
          p_target_id: selectedTargetId,
          p_message:
            message.trim() || null,
        }
      );

      if (error) {
        setErrorMessage(
          getErrorMessage(
            error,
            "送出申請時發生錯誤。"
          )
        );
        return;
      }

      setSelectedTargetId("");
      setMessage("");

      await loadPage();

      setSuccessMessage("申請已送出。");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "送出申請時發生錯誤。"
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRespond(
    requestId: string,
    accept: boolean
  ) {
    setProcessingId(requestId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "respond_voluntary_subordination_request",
        {
          p_request_id: requestId,
          p_accept: accept,
        }
      );

      if (error) {
        setErrorMessage(
          getErrorMessage(
            error,
            "處理申請時發生錯誤。"
          )
        );
        return;
      }

      await loadPage();

      setSuccessMessage(
        accept
          ? "你已接受這筆申請。"
          : "你已拒絕這筆申請。"
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "處理申請時發生錯誤。"
        )
      );
    } finally {
      setProcessingId(null);
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

  function getGenderLabel(
    gender: ProfileSummary["gender"]
  ) {
    if (gender === "female") {
      return "女性";
    }

    if (gender === "male") {
      return "男性";
    }

    return "其他";
  }

  function getStatusLabel(
    status: RequestStatus
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

  function getStatusClass(
    status: RequestStatus
  ) {
    if (status === "accepted") {
      return "border-emerald-900 text-emerald-300";
    }

    if (status === "rejected") {
      return "border-red-900 text-red-300";
    }

    if (status === "cancelled") {
      return "border-neutral-700 text-neutral-500";
    }

    return "border-amber-900 text-amber-300";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取申請資料…
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
              歸屬申請
            </h1>

            {currentProfile && (
              <p className="mt-3 text-neutral-400">
                {currentProfile.nickname}
                ・序號{" "}
                {formatSequence(
                  currentProfile.join_sequence
                )}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Link
              href="/hierarchy"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              階級關係
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
          <div className="mb-5 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-300">
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-xl font-medium">
            提出自願歸屬申請
          </h2>

          <p className="mt-2 text-sm leading-6 text-neutral-400">
            一般情況下，你可以向比自己晚加入的成員提出申請。女性也可以主動向男性提出自願歸屬，不受加入先後限制。
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="target"
                className="mb-2 block text-sm text-neutral-300"
              >
                申請對象
              </label>

              <select
                id="target"
                value={selectedTargetId}
                onChange={(event) =>
                  setSelectedTargetId(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none focus:border-neutral-400"
              >
                <option value="">
                  請選擇玩家
                </option>

                {candidates.map(
                  (candidate) => (
                    <option
                      key={candidate.id}
                      value={candidate.id}
                    >
                      {candidate.nickname}
                      ｜序號{" "}
                      {formatSequence(
                        candidate.join_sequence
                      )}
                      ｜
                      {getGenderLabel(
                        candidate.gender
                      )}
                    </option>
                  )
                )}
              </select>

              {candidates.length === 0 && (
                <p className="mt-2 text-sm text-neutral-500">
                  目前沒有符合條件的申請對象。
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-2 block text-sm text-neutral-300"
              >
                附言
              </label>

              <textarea
                id="message"
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value
                  )
                }
                rows={4}
                maxLength={500}
                placeholder="可選填申請理由或說明"
                className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none focus:border-neutral-400"
              />

              <p className="mt-1 text-right text-xs text-neutral-600">
                {message.length}/500
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreateRequest}
              disabled={
                submitting ||
                !selectedTargetId ||
                candidates.length === 0
              }
              className="rounded-lg bg-neutral-100 px-5 py-3 font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "正在送出…"
                : "送出自願歸屬申請"}
            </button>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-medium">
              收到的申請
            </h2>

            <span className="text-sm text-neutral-500">
              {
                receivedRequests.filter(
                  (item) =>
                    item.request.status ===
                    "pending"
                ).length
              }{" "}
              筆待處理
            </span>
          </div>

          {receivedRequests.length === 0 ? (
            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有收到申請。
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {receivedRequests.map(
                (item) => (
                  <article
                    key={item.request.id}
                    className="rounded-xl bg-neutral-950 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-medium">
                          {
                            item.otherProfile
                              .nickname
                          }
                        </p>

                        <p className="mt-2 text-sm text-neutral-500">
                          序號{" "}
                          {formatSequence(
                            item.otherProfile
                              .join_sequence
                          )}
                          ・
                          {getGenderLabel(
                            item.otherProfile
                              .gender
                          )}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
                          item.request.status
                        )}`}
                      >
                        {getStatusLabel(
                          item.request.status
                        )}
                      </span>
                    </div>

                    {item.request.message && (
                      <div className="mt-4 rounded-lg border border-neutral-800 p-4 text-sm leading-6 text-neutral-300">
                        {item.request.message}
                      </div>
                    )}

                    <p className="mt-4 text-sm text-neutral-500">
                      送出時間：
                      {formatDate(
                        item.request.created_at
                      )}
                    </p>

                    {item.request.status ===
                      "pending" && (
                      <div className="mt-5 flex gap-3">
                        <button
                          type="button"
                          disabled={
                            processingId ===
                            item.request.id
                          }
                          onClick={() =>
                            handleRespond(
                              item.request.id,
                              true
                            )
                          }
                          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {processingId ===
                          item.request.id
                            ? "處理中…"
                            : "接受"}
                        </button>

                        <button
                          type="button"
                          disabled={
                            processingId ===
                            item.request.id
                          }
                          onClick={() =>
                            handleRespond(
                              item.request.id,
                              false
                            )
                          }
                          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          拒絕
                        </button>
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-xl font-medium">
            我送出的申請
          </h2>

          {sentRequests.length === 0 ? (
            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有送出的申請。
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {sentRequests.map(
                (item) => (
                  <article
                    key={item.request.id}
                    className="rounded-xl bg-neutral-950 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-medium">
                          {
                            item.otherProfile
                              .nickname
                          }
                        </p>

                        <p className="mt-2 text-sm text-neutral-500">
                          序號{" "}
                          {formatSequence(
                            item.otherProfile
                              .join_sequence
                          )}
                          ・
                          {getGenderLabel(
                            item.otherProfile
                              .gender
                          )}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
                          item.request.status
                        )}`}
                      >
                        {getStatusLabel(
                          item.request.status
                        )}
                      </span>
                    </div>

                    {item.request.message && (
                      <div className="mt-4 rounded-lg border border-neutral-800 p-4 text-sm leading-6 text-neutral-300">
                        {item.request.message}
                      </div>
                    )}

                    <p className="mt-4 text-sm text-neutral-500">
                      送出時間：
                      {formatDate(
                        item.request.created_at
                      )}
                    </p>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}