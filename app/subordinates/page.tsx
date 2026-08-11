"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  nickname: string;

  gender:
    | "female"
    | "male"
    | "other";

  join_sequence: number;

  accepting_subordinates: boolean;

  subordinate_limit: number;
};

type Subordinate = {
  id: string;
  nickname: string;

  gender:
    | "female"
    | "male"
    | "other";

  join_sequence: number;

  relation_type:
    | "automatic"
    | "voluntary"
    | "admin_assigned"
    | "system";

  relation_created_at: string;
};

type RelationRow = {
  subordinate_id: string;

  relation_type:
    | "automatic"
    | "voluntary"
    | "admin_assigned"
    | "system";

  created_at: string;
};

type SubordinateProfile = {
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

export default function SubordinatesPage() {
  const router =
    useRouter();

  const [
    profile,
    setProfile,
  ] =
    useState<
      Profile | null
    >(null);

  const [
    subordinates,
    setSubordinates,
  ] =
    useState<
      Subordinate[]
    >([]);

  const [
    worldStatus,
    setWorldStatus,
  ] =
    useState<
      WorldStatus | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    releasingId,
    setReleasingId,
  ] =
    useState<string | null>(
      null
    );

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
    void loadPage();
  }, []);

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

      setWorldStatus({
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
      });
    }
  }

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
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
          profileData,
        error:
          profileError,
      } =
        await supabase
          .from(
            "profiles"
          )
          .select(`
            id,
            nickname,
            gender,
            join_sequence,
            accepting_subordinates,
            subordinate_limit
          `)
          .eq(
            "id",
            user.id
          )
          .single();

      if (
        profileError
      ) {
        throw profileError;
      }

      setProfile(
        profileData as Profile
      );

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
          .select(`
            subordinate_id,
            relation_type,
            created_at
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
              ascending:
                true,
            }
          );

      if (
        relationError
      ) {
        throw relationError;
      }

      const relations =
        (
          relationData ??
          []
        ) as RelationRow[];

      if (
        relations.length ===
        0
      ) {
        setSubordinates(
          []
        );

        return;
      }

      const subordinateIds =
        relations.map(
          (
            relation
          ) =>
            relation.subordinate_id
        );

      const {
        data:
          subordinateProfiles,
        error:
          subordinateProfilesError,
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
            (
              subordinateProfiles ??
              []
            ) as SubordinateProfile[]
          ).map(
            (
              member
            ) => [
              member.id,
              member,
            ]
          )
        );

      const result:
        Subordinate[] =
        relations
          .map(
            (
              relation
            ) => {
              const member =
                profileMap.get(
                  relation.subordinate_id
                );

              if (!member) {
                return null;
              }

              return {
                id:
                  member.id,

                nickname:
                  member.nickname,

                gender:
                  member.gender,

                join_sequence:
                  member.join_sequence,

                relation_type:
                  relation.relation_type,

                relation_created_at:
                  relation.created_at,
              };
            }
          )
          .filter(
            (
              item
            ): item is Subordinate =>
              item !==
              null
          )
          .sort(
            (
              a,
              b
            ) =>
              a.join_sequence -
              b.join_sequence
          );

      setSubordinates(
        result
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "讀取從屬者資料時發生錯誤。"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function handleToggleAccepting() {
    if (
      !profile ||
      saving
    ) {
      return;
    }

    setSaving(true);

    setErrorMessage("");

    setSuccessMessage("");

    const newValue =
      !profile.accepting_subordinates;

    try {
      const {
        error,
      } =
        await supabase
          .from(
            "profiles"
          )
          .update({
            accepting_subordinates:
              newValue,
          })
          .eq(
            "id",
            profile.id
          );

      if (error) {
        throw error;
      }

      setProfile({
        ...profile,

        accepting_subordinates:
          newValue,
      });

      setSuccessMessage(
        newValue
          ? "已開啟接收新從屬者。"
          : "已停止接收新從屬者。"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "更新接收狀態時發生錯誤。"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  async function handleReleaseSubordinate(
    subordinate: Subordinate
  ) {
    if (
      releasingId
    ) {
      return;
    }

    const confirmed =
  window.confirm(
    `確定要解除與「${subordinate.nickname}」的主從關係嗎？\n\n解除後，雙方將無法繼續使用此主從聊天室。`
  );

    if (
      !confirmed
    ) {
      return;
    }

    setReleasingId(
      subordinate.id
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "release_my_subordinate",
          {
            p_subordinate_id:
              subordinate.id,
          }
        );

      if (error) {
        throw error;
      }

      setSubordinates(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.id !==
              subordinate.id
          )
      );

      setSuccessMessage(
        `已解除與「${subordinate.nickname}」的主從關係。`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "解除主從關係時發生錯誤。"
      );
    } finally {
      setReleasingId(
        null
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

  function formatDate(
    dateString: string
  ) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        timeZone:
          "Asia/Taipei",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    ).format(
      new Date(
        dateString
      )
    );
  }

  function getGenderLabel(
    gender:
      Subordinate["gender"]
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

  function getRelationLabel(
    type:
      Subordinate["relation_type"]
  ) {
    if (
      type ===
      "automatic"
    ) {
      return "系統分配";
    }

    if (
      type ===
      "voluntary"
    ) {
      return "自願歸屬";
    }

    if (
      type ===
      "admin_assigned"
    ) {
      return "管理員指派";
    }

    return "系統建立";
  }

  const remainingSlots =
    profile
      ? Math.max(
          profile.subordinate_limit -
            subordinates.length,
          0
        )
      : 0;

  const worldMaintenanceInsufficient =
    worldStatus
      ?.maintenance_status ===
    "insufficient";

  const canSendTask =
    Boolean(
      worldStatus
        ?.can_send_task
    );

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取從屬者資料…
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
              從屬者管理
            </h1>

            <p className="mt-3 text-neutral-400">
              查看你的直接從屬者與接收狀態。
            </p>

          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            返回主頁
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

            <p className="mt-3 max-w-3xl leading-7 text-red-100/80">
              你的世界積分已耗盡，目前無法主動向從屬者發送新任務。
              你仍然可以查看從屬者、調整接收設定，以及查看過去已發出的任務。
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

        {profile && (
          <>

            <section className="mb-6 grid gap-4 sm:grid-cols-3">

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">

                <p className="text-sm text-neutral-500">
                  目前從屬者
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {
                    subordinates.length
                  }{" "}
                  人
                </p>

              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">

                <p className="text-sm text-neutral-500">
                  接收上限
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {
                    profile.subordinate_limit
                  }{" "}
                  人
                </p>

              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">

                <p className="text-sm text-neutral-500">
                  剩餘名額
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {
                    remainingSlots
                  }{" "}
                  人
                </p>

              </div>

            </section>

            <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

              <div className="flex flex-wrap items-center justify-between gap-5">

                <div>

                  <p className="text-sm text-neutral-500">
                    接收設定
                  </p>

                  <p className="mt-2 text-lg font-medium">
                    {profile
                      .accepting_subordinates
                      ? "目前接受新從屬者"
                      : "目前停止接收"}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    關閉後，系統在分配新的歸屬關係時不會將新成員分配給你。
                  </p>

                </div>

                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={
                    handleToggleAccepting
                  }
                  className="rounded-lg border border-neutral-700 px-5 py-3 text-sm text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "更新中…"
                    : profile
                        .accepting_subordinates
                      ? "停止接收"
                      : "開始接收"}
                </button>

              </div>

            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">

                <div>

                  <p className="text-sm text-neutral-500">
                    我的直接從屬者
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold">
                    {
                      subordinates.length
                    }{" "}
                    人
                  </h2>

                </div>

                <Link
                  href="/tasks/sent"
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                >
                  查看已發送任務
                </Link>

              </div>

              {subordinates.length ===
              0 ? (

                <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
                  目前沒有直接從屬者。
                </div>

              ) : (

                <div className="space-y-4">

                  {subordinates.map(
                    (
                      subordinate
                    ) => (

                      <article
                        key={
                          subordinate.id
                        }
                        className="rounded-xl bg-neutral-950 p-5"
                      >

                        <div className="flex flex-wrap items-start justify-between gap-5">

                          <div>

                            <Link
                              href={`/members/${subordinate.id}`}
                              className="text-lg font-medium transition hover:underline"
                            >
                              {
                                subordinate.nickname
                              }
                            </Link>

                            <p className="mt-2 text-sm text-neutral-500">

                              序號{" "}

                              {formatSequence(
                                subordinate.join_sequence
                              )}

                              ・

                              {getGenderLabel(
                                subordinate.gender
                              )}

                            </p>

                            <p className="mt-2 text-sm text-neutral-500">

                              建立關係：

                              {formatDate(
                                subordinate.relation_created_at
                              )}

                            </p>

                          </div>

                          <div className="flex flex-wrap gap-2">

                            <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">

                              {getRelationLabel(
                                subordinate.relation_type
                              )}

                            </span>

                          </div>

                        </div>

                        <div className="mt-5 flex flex-wrap gap-3 border-t border-neutral-800 pt-4">

                          <Link
                            href={`/members/${subordinate.id}`}
                            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
                          >
                            查看個人頁
                          </Link>

                          {canSendTask ? (

                            <Link
                              href={`/tasks/create/${subordinate.id}`}
                              className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white"
                            >
                              發送任務
                            </Link>

                          ) : (

                            <span className="cursor-not-allowed rounded-lg border border-red-900 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-400">
                              世界維持不足
                            </span>

                          )}

                          <button
                            type="button"
                            disabled={
                              releasingId !==
                              null
                            }
                            onClick={() =>
                              void handleReleaseSubordinate(
                                subordinate
                              )
                            }
                            className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 transition hover:border-red-700 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {releasingId ===
                            subordinate.id
                              ? "解除中…"
                              : "解除關係"}
                          </button>

                        </div>

                      </article>

                    )
                  )}

                </div>

              )}

            </section>

          </>
        )}

      </div>

    </main>
  );
}