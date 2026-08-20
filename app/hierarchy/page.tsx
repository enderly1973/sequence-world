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

type RelationRow = {
  id: string;
  superior_id: string | null;
  subordinate_id: string;
  relation_type:
    | "automatic"
    | "voluntary"
    | "admin_assigned"
    | "system";
  status: "active" | "pending" | "ended" | "suspended";
  created_at: string;
  subordinate_rank: number | null;
};

type SuperiorInfo = {
  relationId: string;
  profile: ProfileSummary;
  relationType: RelationRow["relation_type"];
  createdAt: string;
  chatRoomId: string | null;
  subordinateRank: number | null;
} | null;

type SubordinateInfo = {
  relationId: string;
  profile: ProfileSummary;
  relationType: RelationRow["relation_type"];
  createdAt: string;
  subordinateRank: number | null;
};

type DescendantRow = {
  relation_id: string;
  user_id: string;
  parent_id: string;
  depth: number;
  subordinate_rank: number | null;
};

type SecondGenerationInfo = {
  relationId: string;
  profile: ProfileSummary;
  parentId: string;
  parentProfile: ProfileSummary | null;
  subordinateRank: number | null;
};

export default function HierarchyPage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] =
    useState<ProfileSummary | null>(null);

  const [superior, setSuperior] =
    useState<SuperiorInfo>(null);

  const [subordinates, setSubordinates] =
    useState<SubordinateInfo[]>([]);

  const [secondGeneration, setSecondGeneration] =
    useState<SecondGenerationInfo[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [leaving, setLeaving] =
    useState(false);

  const [
    requestingSuperiorSwap,
    setRequestingSuperiorSwap,
  ] = useState(false);

  const [
    requestingSubordinateSwapId,
    setRequestingSubordinateSwapId,
  ] = useState<string | null>(null);

  const [
    rankingRelationId,
    setRankingRelationId,
  ] = useState<string | null>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    void loadHierarchy();
  }, []);

  async function loadHierarchy() {
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
        .select(`
          id,
          nickname,
          gender,
          join_sequence
        `)
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      setCurrentProfile(
        profileData as ProfileSummary
      );

      /*
       * 我的上級
       */
      const {
        data: superiorRelation,
        error: superiorRelationError,
      } = await supabase
        .from("hierarchy_relations")
        .select(`
          id,
          superior_id,
          subordinate_id,
          relation_type,
          status,
          created_at,
          subordinate_rank
        `)
        .eq(
          "subordinate_id",
          user.id
        )
        .eq(
          "status",
          "active"
        )
        .maybeSingle();

      if (superiorRelationError) {
        throw superiorRelationError;
      }

      if (
        superiorRelation?.superior_id
      ) {
        const {
          data: superiorProfile,
          error: superiorProfileError,
        } = await supabase
          .from("profiles")
          .select(`
            id,
            nickname,
            gender,
            join_sequence
          `)
          .eq(
            "id",
            superiorRelation.superior_id
          )
          .single();

        if (superiorProfileError) {
          throw superiorProfileError;
        }

        const {
          data: chatRoomData,
          error: chatRoomError,
        } = await supabase
          .from(
            "master_slave_chat_rooms"
          )
          .select("id")
          .eq(
            "master_id",
            superiorRelation.superior_id
          )
          .eq(
            "slave_id",
            user.id
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

        if (chatRoomError) {
          throw chatRoomError;
        }

        setSuperior({
          relationId:
            superiorRelation.id,

          profile:
            superiorProfile as ProfileSummary,

          relationType:
            superiorRelation.relation_type,

          createdAt:
            superiorRelation.created_at,

          chatRoomId:
            chatRoomData?.id ?? null,

          subordinateRank:
            superiorRelation.subordinate_rank,
        });
      } else {
        setSuperior(null);
      }

      /*
       * 第一代：直接附屬者
       */
      const {
        data: subordinateRelations,
        error: subordinateRelationsError,
      } = await supabase
        .from("hierarchy_relations")
        .select(`
          id,
          superior_id,
          subordinate_id,
          relation_type,
          status,
          created_at,
          subordinate_rank
        `)
        .eq(
          "superior_id",
          user.id
        )
        .eq(
          "status",
          "active"
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

      if (
        subordinateRelationsError
      ) {
        throw subordinateRelationsError;
      }

      const relationRows =
        (
          subordinateRelations ??
          []
        ) as RelationRow[];

      let directSubordinates:
        SubordinateInfo[] = [];

      if (
        relationRows.length > 0
      ) {
        const subordinateIds =
          relationRows.map(
            (relation) =>
              relation.subordinate_id
          );

        const {
          data: subordinateProfiles,
          error:
            subordinateProfilesError,
        } = await supabase
          .from("profiles")
          .select(`
            id,
            nickname,
            gender,
            join_sequence
          `)
          .in(
            "id",
            subordinateIds
          );

        if (
          subordinateProfilesError
        ) {
          throw subordinateProfilesError;
        }

        const profileMap =
          new Map(
            (
              subordinateProfiles as ProfileSummary[]
            ).map(
              (profile) => [
                profile.id,
                profile,
              ]
            )
          );

        directSubordinates =
          relationRows
            .map(
              (relation) => {
                const profile =
                  profileMap.get(
                    relation.subordinate_id
                  );

                if (!profile) {
                  return null;
                }

                return {
                  relationId:
                    relation.id,

                  profile,

                  relationType:
                    relation.relation_type,

                  createdAt:
                    relation.created_at,

                  subordinateRank:
                    relation.subordinate_rank,
                };
              }
            )
            .filter(
              (
                item
              ): item is SubordinateInfo =>
                item !== null
            )
            .sort(
              (a, b) => {
                if (
                  a.subordinateRank !==
                    null &&
                  b.subordinateRank !==
                    null
                ) {
                  return (
                    a.subordinateRank -
                    b.subordinateRank
                  );
                }

                if (
                  a.subordinateRank !==
                  null
                ) {
                  return -1;
                }

                if (
                  b.subordinateRank !==
                  null
                ) {
                  return 1;
                }

                return (
                  a.profile
                    .join_sequence -
                  b.profile
                    .join_sequence
                );
              }
            );
      }

      setSubordinates(
        directSubordinates
      );

      /*
       * 第二代：直接附屬者的附屬者
       */
      const {
        data: descendantData,
        error: descendantError,
      } = await supabase.rpc(
        "get_my_hierarchy_descendants"
      );

      if (descendantError) {
        throw descendantError;
      }

      const descendants =
        (
          descendantData ??
          []
        ) as DescendantRow[];

      const secondRows =
        descendants.filter(
          (item) =>
            Number(item.depth) ===
            2
        );

      if (
        secondRows.length === 0
      ) {
        setSecondGeneration(
          []
        );
      } else {
        const secondUserIds =
          Array.from(
            new Set(
              secondRows.map(
                (item) =>
                  item.user_id
              )
            )
          );

        const parentIds =
          Array.from(
            new Set(
              secondRows.map(
                (item) =>
                  item.parent_id
              )
            )
          );

        const allProfileIds =
          Array.from(
            new Set([
              ...secondUserIds,
              ...parentIds,
            ])
          );

        const {
          data:
            secondProfileData,
          error:
            secondProfileError,
        } = await supabase
          .from("profiles")
          .select(`
            id,
            nickname,
            gender,
            join_sequence
          `)
          .in(
            "id",
            allProfileIds
          );

        if (
          secondProfileError
        ) {
          throw secondProfileError;
        }

        const secondProfileMap =
          new Map(
            (
              secondProfileData as ProfileSummary[]
            ).map(
              (profile) => [
                profile.id,
                profile,
              ]
            )
          );

        const secondResult =
          secondRows
            .map(
              (row) => {
                const profile =
                  secondProfileMap.get(
                    row.user_id
                  );

                if (!profile) {
                  return null;
                }

                return {
                  relationId:
                    row.relation_id,

                  profile,

                  parentId:
                    row.parent_id,

                  parentProfile:
                    secondProfileMap.get(
                      row.parent_id
                    ) ?? null,

                  subordinateRank:
                    row.subordinate_rank,
                };
              }
            )
            .filter(
              (
                item
              ): item is SecondGenerationInfo =>
                item !== null
            )
            .sort(
              (a, b) => {
                const parentA =
                  a.parentProfile
                    ?.join_sequence ??
                  Number.MAX_SAFE_INTEGER;

                const parentB =
                  b.parentProfile
                    ?.join_sequence ??
                  Number.MAX_SAFE_INTEGER;

                if (
                  parentA !==
                  parentB
                ) {
                  return (
                    parentA -
                    parentB
                  );
                }

                if (
                  a.subordinateRank !==
                    null &&
                  b.subordinateRank !==
                    null
                ) {
                  return (
                    a.subordinateRank -
                    b.subordinateRank
                  );
                }

                if (
                  a.subordinateRank !==
                  null
                ) {
                  return -1;
                }

                if (
                  b.subordinateRank !==
                  null
                ) {
                  return 1;
                }

                return (
                  a.profile
                    .join_sequence -
                  b.profile
                    .join_sequence
                );
              }
            );

        setSecondGeneration(
          secondResult
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "讀取階級關係時發生錯誤。";

      setErrorMessage(
        message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSetSubordinateRank(
    item: SubordinateInfo,
    newRank: number
  ) {
    if (
      rankingRelationId !==
        null ||
      requestingSuperiorSwap ||
      requestingSubordinateSwapId !==
        null ||
      leaving
    ) {
      return;
    }

    if (
      item.subordinateRank ===
      newRank
    ) {
      return;
    }

    setRankingRelationId(
      item.relationId
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "set_subordinate_rank",
        {
          p_relation_id:
            item.relationId,

          p_rank:
            newRank,
        }
      );

      if (error) {
        throw error;
      }

      await loadHierarchy();

      setSuccessMessage(
        `已將「${item.profile.nickname}」調整為第 ${newRank} 位從屬者。`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "調整從屬者順位時發生錯誤。"
      );
    } finally {
      setRankingRelationId(
        null
      );
    }
  }

  async function handleRequestSuperiorSwap() {
    if (
      !superior ||
      requestingSuperiorSwap ||
      leaving ||
      requestingSubordinateSwapId !==
        null ||
      rankingRelationId !==
        null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `確定要向「${superior.profile.nickname}」提出地位交換申請嗎？\n\n對方同意後，你將成為上級，對方將成為從屬者。`
      );

    if (!confirmed) {
      return;
    }

    setRequestingSuperiorSwap(
      true
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "request_hierarchy_swap",
        {
          p_relation_id:
            superior.relationId,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `已向「${superior.profile.nickname}」提出地位交換申請。`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "提出地位交換申請時發生錯誤。"
      );
    } finally {
      setRequestingSuperiorSwap(
        false
      );
    }
  }

  async function handleRequestSubordinateSwap(
    item: SubordinateInfo
  ) {
    if (
      requestingSubordinateSwapId !==
        null ||
      requestingSuperiorSwap ||
      leaving ||
      rankingRelationId !==
        null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `確定要向「${item.profile.nickname}」提出地位交換申請嗎？\n\n對方同意後，對方將成為上級，你將成為從屬者。`
      );

    if (!confirmed) {
      return;
    }

    setRequestingSubordinateSwapId(
      item.relationId
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "request_hierarchy_swap",
        {
          p_relation_id:
            item.relationId,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `已向「${item.profile.nickname}」提出地位交換申請。`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "提出地位交換申請時發生錯誤。"
      );
    } finally {
      setRequestingSubordinateSwapId(
        null
      );
    }
  }

  async function handleLeaveSuperior() {
    if (
      !superior ||
      leaving ||
      requestingSuperiorSwap ||
      requestingSubordinateSwapId !==
        null ||
      rankingRelationId !==
        null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `確定要解除對「${superior.profile.nickname}」的歸屬關係嗎？\n\n解除後，雙方將無法繼續使用此主從聊天室。`
      );

    if (!confirmed) {
      return;
    }

    setLeaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "leave_my_superior"
      );

      if (error) {
        throw error;
      }

      const superiorName =
        superior.profile.nickname;

      setSuperior(null);

      setSuccessMessage(
        `已解除對「${superiorName}」的歸屬關係。`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "解除歸屬關係時發生錯誤。"
      );
    } finally {
      setLeaving(false);
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

  function formatDate(
    dateString: string
  ) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).format(
      new Date(
        dateString
      )
    );
  }

  function getGenderLabel(
    gender:
      ProfileSummary["gender"]
  ) {
    if (
      gender === "female"
    ) {
      return "女性";
    }

    if (
      gender === "male"
    ) {
      return "男性";
    }

    return "其他";
  }

  function getRelationLabel(
    relationType:
      RelationRow["relation_type"]
  ) {
    if (
      relationType ===
      "automatic"
    ) {
      return "系統分配";
    }

    if (
      relationType ===
      "voluntary"
    ) {
      return "自願歸屬";
    }

    if (
      relationType ===
      "admin_assigned"
    ) {
      return "管理員指派";
    }

    return "系統歸屬";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取階級關係…
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
              階級關係
            </h1>

            {currentProfile && (
              <p className="mt-3 text-neutral-400">
                {
                  currentProfile.nickname
                }
                ・序號{" "}
                {formatSequence(
                  currentProfile.join_sequence
                )}
              </p>
            )}

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/hierarchy/swaps"
              className="rounded-lg border border-violet-900 px-4 py-2 text-sm text-violet-300 transition hover:border-violet-700 hover:bg-violet-950/30"
            >
              地位交換申請
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

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          <p className="text-sm text-neutral-500">
            我的上級
          </p>

          {superior ? (

            <div className="mt-5 rounded-xl bg-neutral-950 p-5">

              <div className="flex flex-wrap items-start justify-between gap-4">

                <div>

                  <p className="text-xl font-medium">
                    {
                      superior.profile.nickname
                    }
                  </p>

                  <p className="mt-2 text-sm text-neutral-500">
                    序號{" "}
                    {formatSequence(
                      superior.profile.join_sequence
                    )}
                    ・
                    {getGenderLabel(
                      superior.profile.gender
                    )}
                  </p>

                </div>

                <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                  {getRelationLabel(
                    superior.relationType
                  )}
                </span>

              </div>

              <p className="mt-4 text-sm text-neutral-500">
                關係建立日期：
                {formatDate(
                  superior.createdAt
                )}
              </p>

              <div className="mt-3">

                {superior.subordinateRank !==
                null ? (

                  <span className="inline-flex rounded-full border border-amber-800 bg-amber-950/30 px-3 py-1 text-sm font-medium text-amber-300">
                    我在此上級名下：第{" "}
                    {
                      superior.subordinateRank
                    }{" "}
                    位
                  </span>

                ) : (

                  <span className="inline-flex rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-500">
                    上級尚未設定我的順位
                  </span>

                )}

              </div>

              <div className="mt-5 flex flex-wrap gap-3 border-t border-neutral-800 pt-4">

                <Link
                  href={`/members/${superior.profile.id}`}
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                >
                  查看上級
                </Link>

                {superior.chatRoomId ? (

                  <Link
                    href={`/chat/${superior.chatRoomId}`}
                    className="rounded-lg border border-sky-900 px-4 py-2 text-sm text-sky-300 transition hover:border-sky-700 hover:bg-sky-950/20"
                  >
                    主從聊天室
                  </Link>

                ) : (

                  <span className="cursor-not-allowed rounded-lg border border-neutral-800 px-4 py-2 text-sm text-neutral-600">
                    尚無聊天室
                  </span>

                )}

                <Link
                  href="/tasks"
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                >
                  我的任務
                </Link>

                <button
                  type="button"
                  disabled={
                    requestingSuperiorSwap ||
                    leaving ||
                    requestingSubordinateSwapId !==
                      null ||
                    rankingRelationId !==
                      null
                  }
                  onClick={() =>
                    void handleRequestSuperiorSwap()
                  }
                  className="rounded-lg border border-violet-900 px-4 py-2 text-sm text-violet-300 transition hover:border-violet-700 hover:bg-violet-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {requestingSuperiorSwap
                    ? "申請中…"
                    : "申請地位交換"}
                </button>

                <button
                  type="button"
                  disabled={
                    leaving ||
                    requestingSuperiorSwap ||
                    requestingSubordinateSwapId !==
                      null ||
                    rankingRelationId !==
                      null
                  }
                  onClick={() =>
                    void handleLeaveSuperior()
                  }
                  className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 transition hover:border-red-700 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {leaving
                    ? "解除中…"
                    : "解除歸屬"}
                </button>

              </div>

            </div>

          ) : (

            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有上級。
            </div>

          )}

        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-sm text-neutral-500">
                第一代・我的直接附屬者
              </p>

              <p className="mt-2 text-sm text-neutral-400">
                由你直接管理，可調整旗下順位。
              </p>

            </div>

            <span className="text-sm text-neutral-400">
              共 {
                subordinates.length
              } 人
            </span>

          </div>

          {subordinates.length ===
          0 ? (

            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有直接附屬者。
            </div>

          ) : (

            <div className="mt-5 space-y-3">

              {subordinates.map(
                (item) => (

                  <article
                    key={
                      item.relationId
                    }
                    className="rounded-xl bg-neutral-950 p-5"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-4">

                      <div>

                        <div className="flex flex-wrap items-center gap-3">

                          <p className="text-lg font-medium">
                            {
                              item.profile.nickname
                            }
                          </p>

                          {item.subordinateRank !==
                          null ? (

                            <span className="rounded-full border border-amber-800 bg-amber-950/30 px-3 py-1 text-xs font-medium text-amber-300">
                              第{" "}
                              {
                                item.subordinateRank
                              }{" "}
                              位
                            </span>

                          ) : (

                            <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-500">
                              尚未設定順位
                            </span>

                          )}

                        </div>

                        <p className="mt-2 text-sm text-neutral-500">
                          序號{" "}
                          {formatSequence(
                            item.profile.join_sequence
                          )}
                          ・
                          {getGenderLabel(
                            item.profile.gender
                          )}
                        </p>

                      </div>

                      <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                        {getRelationLabel(
                          item.relationType
                        )}
                      </span>

                    </div>

                    <p className="mt-4 text-sm text-neutral-500">
                      關係建立日期：
                      {formatDate(
                        item.createdAt
                      )}
                    </p>

                    <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900 p-4">

                      <p className="text-sm font-medium text-neutral-300">
                        附屬者階級順位
                      </p>

                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        第 1 位代表你旗下最高順位。若選擇已有人使用的順位，兩人的順位會自動交換。
                      </p>

                      <select
                        value={
                          item.subordinateRank ??
                          ""
                        }
                        disabled={
                          rankingRelationId !==
                            null ||
                          requestingSuperiorSwap ||
                          requestingSubordinateSwapId !==
                            null ||
                          leaving
                        }
                        onChange={(
                          event
                        ) => {
                          const value =
                            Number(
                              event.target.value
                            );

                          if (
                            Number.isInteger(
                              value
                            ) &&
                            value >=
                              1
                          ) {
                            void handleSetSubordinateRank(
                              item,
                              value
                            );
                          }
                        }}
                        className="mt-3 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2 text-sm text-neutral-200 outline-none transition focus:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-56"
                      >

                        <option
                          value=""
                          disabled
                        >
                          選擇順位
                        </option>

                        {Array.from(
                          {
                            length:
                              subordinates.length,
                          },
                          (
                            _,
                            index
                          ) =>
                            index +
                            1
                        ).map(
                          (
                            rank
                          ) => (
                            <option
                              key={
                                rank
                              }
                              value={
                                rank
                              }
                            >
                              第{" "}
                              {
                                rank
                              }{" "}
                              位
                            </option>
                          )
                        )}

                      </select>

                      {rankingRelationId ===
                        item.relationId && (
                        <p className="mt-2 text-xs text-amber-300">
                          正在調整順位…
                        </p>
                      )}

                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 border-t border-neutral-800 pt-4">

                      <Link
                        href={`/members/${item.profile.id}`}
                        className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                      >
                        查看附屬者
                      </Link>

                      <button
                        type="button"
                        disabled={
                          requestingSubordinateSwapId !==
                            null ||
                          requestingSuperiorSwap ||
                          leaving ||
                          rankingRelationId !==
                            null
                        }
                        onClick={() =>
                          void handleRequestSubordinateSwap(
                            item
                          )
                        }
                        className="rounded-lg border border-violet-900 px-4 py-2 text-sm text-violet-300 transition hover:border-violet-700 hover:bg-violet-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {requestingSubordinateSwapId ===
                        item.relationId
                          ? "申請中…"
                          : "申請地位交換"}
                      </button>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>

              <p className="text-sm text-neutral-500">
                第二代・附屬者的附屬者
              </p>

              <p className="mt-2 text-sm text-neutral-400">
                顯示你旗下第一代成員所管理的直接附屬者。
              </p>

            </div>

            <span className="text-sm text-neutral-400">
              共 {
                secondGeneration.length
              } 人
            </span>

          </div>

          {secondGeneration.length ===
          0 ? (

            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有第二代附屬者。
            </div>

          ) : (

            <div className="mt-5 space-y-3">

              {secondGeneration.map(
                (item) => (

                  <article
                    key={
                      item.relationId
                    }
                    className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-4">

                      <div>

                        <div className="flex flex-wrap items-center gap-3">

                          <Link
                            href={`/members/${item.profile.id}`}
                            className="text-lg font-medium transition hover:underline"
                          >
                            {
                              item.profile.nickname
                            }
                          </Link>

                          <span className="rounded-full border border-sky-900 bg-sky-950/20 px-3 py-1 text-xs text-sky-300">
                            第二代
                          </span>

                          {item.subordinateRank !==
                          null && (
                            <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                              在直屬主人名下第{" "}
                              {
                                item.subordinateRank
                              }{" "}
                              位
                            </span>
                          )}

                        </div>

                        <p className="mt-2 text-sm text-neutral-500">
                          序號{" "}
                          {formatSequence(
                            item.profile.join_sequence
                          )}
                          ・
                          {getGenderLabel(
                            item.profile.gender
                          )}
                        </p>

                        <p className="mt-3 text-sm text-neutral-400">
                          直屬主人：
                          {item.parentProfile ? (
                            <>
                              {" "}
                              <Link
                                href={`/members/${item.parentProfile.id}`}
                                className="text-neutral-200 transition hover:underline"
                              >
                                {
                                  item.parentProfile.nickname
                                }
                              </Link>

                              <span className="text-neutral-600">
                                {" "}
                                ・序號{" "}
                                {formatSequence(
                                  item.parentProfile.join_sequence
                                )}
                              </span>
                            </>
                          ) : (
                            " 無法取得資料"
                          )}
                        </p>

                      </div>

                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 border-t border-neutral-800 pt-4">

                      <Link
                        href={`/members/${item.profile.id}`}
                        className="inline-flex rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                      >
                        查看第二代成員
                      </Link>

                      <Link
                        href={`/tasks/create/${item.profile.id}`}
                        className="inline-flex rounded-lg border border-emerald-900 px-4 py-2 text-sm text-emerald-300 transition hover:border-emerald-700 hover:bg-emerald-950/20"
                      >
                        派發任務
                      </Link>

                    </div>

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