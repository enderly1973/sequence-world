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

type RelationStatus =
  | "active"
  | "pending"
  | "ended"
  | "suspended";

type RelationType =
  | "automatic"
  | "voluntary"
  | "admin_assigned"
  | "system";

type RelationRow = {
  id: string;
  superior_id: string | null;
  subordinate_id: string;
  relation_type: RelationType;
  status: RelationStatus;
  created_at: string;
  ended_at: string | null;
};

type HistoryItem = {
  relation: RelationRow;
  superior: ProfileSummary | null;
  subordinate: ProfileSummary | null;
};

export default function HistoryPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState("");
  const [currentProfile, setCurrentProfile] =
    useState<ProfileSummary | null>(null);

  const [history, setHistory] =
    useState<HistoryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
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

      setCurrentProfile(
        profileData as ProfileSummary
      );

      const {
        data: relationData,
        error: relationError,
      } = await supabase
        .from("hierarchy_relations")
        .select(`
          id,
          superior_id,
          subordinate_id,
          relation_type,
          status,
          created_at,
          ended_at
        `)
        .or(
          `superior_id.eq.${user.id},subordinate_id.eq.${user.id}`
        )
        .order("created_at", {
          ascending: false,
        });

      if (relationError) {
        throw relationError;
      }

      const relations =
        (relationData ?? []) as RelationRow[];

      if (relations.length === 0) {
        setHistory([]);
        return;
      }

      const profileIds = Array.from(
        new Set(
          relations.flatMap((relation) => {
            const ids: string[] = [];

            if (relation.superior_id) {
              ids.push(relation.superior_id);
            }

            ids.push(relation.subordinate_id);

            return ids;
          })
        )
      );

      const {
        data: relatedProfiles,
        error: relatedProfilesError,
      } = await supabase
        .from("profiles")
        .select(
          "id, nickname, gender, join_sequence"
        )
        .in("id", profileIds);

      if (relatedProfilesError) {
        throw relatedProfilesError;
      }

      const profileMap = new Map(
        (
          (relatedProfiles ??
            []) as ProfileSummary[]
        ).map((profile) => [
          profile.id,
          profile,
        ])
      );

      const result: HistoryItem[] =
        relations.map((relation) => ({
          relation,
          superior: relation.superior_id
            ? profileMap.get(
                relation.superior_id
              ) ?? null
            : null,
          subordinate:
            profileMap.get(
              relation.subordinate_id
            ) ?? null,
        }));

      setHistory(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取關係紀錄時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

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

  function getRelationLabel(
    type: RelationType
  ) {
    if (type === "automatic") {
      return "系統分配";
    }

    if (type === "voluntary") {
      return "自願歸屬";
    }

    if (type === "admin_assigned") {
      return "管理員指派";
    }

    return "系統建立";
  }

  function getStatusLabel(
    status: RelationStatus
  ) {
    if (status === "active") {
      return "目前有效";
    }

    if (status === "ended") {
      return "已結束";
    }

    if (status === "pending") {
      return "等待中";
    }

    return "已暫停";
  }

  function getStatusClass(
    status: RelationStatus
  ) {
    if (status === "active") {
      return "border-emerald-900 text-emerald-300";
    }

    if (status === "ended") {
      return "border-neutral-700 text-neutral-500";
    }

    if (status === "pending") {
      return "border-amber-900 text-amber-300";
    }

    return "border-red-900 text-red-300";
  }

  function getMyPosition(
    relation: RelationRow
  ) {
    if (
      relation.superior_id ===
      currentUserId
    ) {
      return "上級";
    }

    return "從屬者";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取關係紀錄…
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
              關係紀錄
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
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-sm text-neutral-500">
            歷史關係總數
          </p>

          <p className="mt-2 text-2xl font-semibold">
            {history.length} 筆
          </p>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          {history.length === 0 ? (
            <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有任何關係紀錄。
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => {
                const isSuperior =
                  item.relation
                    .superior_id ===
                  currentUserId;

                const otherPerson =
                  isSuperior
                    ? item.subordinate
                    : item.superior;

                return (
                  <article
                    key={item.relation.id}
                    className="rounded-xl bg-neutral-950 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-medium">
                            {otherPerson
                              ? otherPerson.nickname
                              : "未知成員"}
                          </p>

                          <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400">
                            你是
                            {getMyPosition(
                              item.relation
                            )}
                          </span>
                        </div>

                        {otherPerson && (
                          <p className="mt-2 text-sm text-neutral-500">
                            序號{" "}
                            {formatSequence(
                              otherPerson.join_sequence
                            )}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                          {getRelationLabel(
                            item.relation
                              .relation_type
                          )}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
                            item.relation.status
                          )}`}
                        >
                          {getStatusLabel(
                            item.relation.status
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 border-t border-neutral-800 pt-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-neutral-600">
                          關係建立
                        </p>

                        <p className="mt-1 text-sm text-neutral-400">
                          {formatDate(
                            item.relation
                              .created_at
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-neutral-600">
                          關係結束
                        </p>

                        <p className="mt-1 text-sm text-neutral-400">
                          {item.relation
                            .ended_at
                            ? formatDate(
                                item
                                  .relation
                                  .ended_at
                              )
                            : "尚未結束"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}