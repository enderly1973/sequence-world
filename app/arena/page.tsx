"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  nickname: string;
  join_sequence: number;

  gender:
    | "female"
    | "male"
    | "other";

  arena_points: number;
};

type RelationRow = {
  superior_id: string;
  subordinate_id: string;
};

type CompetitionStatus =
  | "pending"
  | "accepted"
  | "playing"
  | "completed"
  | "cancelled";

type Competition = {
  id: string;

  challenger_id: string;
  opponent_id: string;

  challenger_subordinate_id: string;

  opponent_subordinate_id:
    | string
    | null;

  status: CompetitionStatus;

  challenger_score: number;
  opponent_score: number;

  winner_id:
    | string
    | null;

  created_at: string;
};

type ArenaStats = {
  camp_matches: number;
  camp_wins: number;
  camp_losses: number;

  fighter_matches: number;
  fighter_wins: number;
  fighter_losses: number;

  fighter_round_wins: number;
  fighter_round_losses: number;
  fighter_round_draws: number;
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

export default function ArenaPage() {
  const router =
    useRouter();

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState("");

  const [
    profiles,
    setProfiles,
  ] =
    useState<
      Profile[]
    >([]);

  const [
    relations,
    setRelations,
  ] =
    useState<
      RelationRow[]
    >([]);

  const [
    competitions,
    setCompetitions,
  ] =
    useState<
      Competition[]
    >([]);

  const [
    stats,
    setStats,
  ] =
    useState<ArenaStats>({
      camp_matches: 0,
      camp_wins: 0,
      camp_losses: 0,

      fighter_matches: 0,
      fighter_wins: 0,
      fighter_losses: 0,

      fighter_round_wins: 0,
      fighter_round_losses: 0,
      fighter_round_draws: 0,
    });

  const [
    worldStatus,
    setWorldStatus,
  ] =
    useState<
      WorldStatus | null
    >(null);

  const [
    opponentId,
    setOpponentId,
  ] =
    useState("");

  const [
    fighterId,
    setFighterId,
  ] =
    useState("");

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

  useEffect(() => {
    void loadArena();
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

  async function loadArena() {
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

      setCurrentUserId(
        user.id
      );

      // =========================
      // 世界維持狀態
      // =========================

      await loadWorldStatus();

      // =========================
      // 每日任務
      // 進入競技場
      // =========================

      const {
        error:
          missionError,
      } =
        await supabase.rpc(
          "complete_daily_mission",
          {
            p_mission_key:
              "visit_arena",
          }
        );

      if (
        missionError
      ) {
        throw missionError;
      }

      // =========================
      // 玩家資料
      // =========================

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
            join_sequence,
            gender,
            arena_points
          `)
          .eq(
            "status",
            "active"
          )
          .order(
            "join_sequence",
            {
              ascending:
                true,
            }
          );

      if (
        profileError
      ) {
        throw profileError;
      }

      setProfiles(
        (profileData ??
          []) as Profile[]
      );

      // =========================
      // 階級關係
      // =========================

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
            superior_id,
            subordinate_id
          `)
          .eq(
            "status",
            "active"
          );

      if (
        relationError
      ) {
        throw relationError;
      }

      setRelations(
        (relationData ??
          []) as RelationRow[]
      );

      // =========================
      // 我的競賽
      // =========================

      const {
        data:
          competitionData,
        error:
          competitionError,
      } =
        await supabase
          .from(
            "competitions"
          )
          .select(`
            id,
            challenger_id,
            opponent_id,
            challenger_subordinate_id,
            opponent_subordinate_id,
            status,
            challenger_score,
            opponent_score,
            winner_id,
            created_at
          `)
          .or(
            `challenger_id.eq.${user.id},opponent_id.eq.${user.id},challenger_subordinate_id.eq.${user.id},opponent_subordinate_id.eq.${user.id}`
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          );

      if (
        competitionError
      ) {
        throw competitionError;
      }

      setCompetitions(
        (competitionData ??
          []) as Competition[]
      );

      // =========================
      // 競技戰績
      // =========================

      const {
        data:
          statsData,
        error:
          statsError,
      } =
        await supabase.rpc(
          "get_my_arena_stats"
        );

      if (
        statsError
      ) {
        throw statsError;
      }

      if (
        Array.isArray(
          statsData
        ) &&
        statsData.length >
          0
      ) {
        setStats(
          statsData[0] as ArenaStats
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "讀取競技場資料時發生錯誤。"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  const currentProfile =
    useMemo(
      () =>
        profiles.find(
          (
            profile
          ) =>
            profile.id ===
            currentUserId
        ) ??
        null,
      [
        profiles,
        currentUserId,
      ]
    );

  const mySubordinates =
    useMemo(() => {
      const subordinateIds =
        relations
          .filter(
            (
              relation
            ) =>
              relation.superior_id ===
              currentUserId
          )
          .map(
            (
              relation
            ) =>
              relation.subordinate_id
          );

      return profiles.filter(
        (
          profile
        ) =>
          subordinateIds.includes(
            profile.id
          )
      );
    }, [
      relations,
      profiles,
      currentUserId,
    ]);

  const availableOpponents =
    useMemo(() => {
      const superiorIds =
        new Set(
          relations.map(
            (
              relation
            ) =>
              relation.superior_id
          )
        );

      return profiles.filter(
        (
          profile
        ) =>
          profile.id !==
            currentUserId &&
          superiorIds.has(
            profile.id
          )
      );
    }, [
      relations,
      profiles,
      currentUserId,
    ]);

  const worldMaintenanceInsufficient =
    worldStatus
      ?.maintenance_status ===
    "insufficient";

  const canStartCompetition =
    Boolean(
      worldStatus
        ?.can_start_competition
    );

  function getProfile(
    id: string | null
  ) {
    if (!id) {
      return null;
    }

    return (
      profiles.find(
        (
          profile
        ) =>
          profile.id === id
      ) ??
      null
    );
  }

  async function handleCreateCompetition() {
    if (
      submitting
    ) {
      return;
    }

    setErrorMessage("");

    // =========================
    // 世界維持不足
    // =========================

    if (
      worldMaintenanceInsufficient ||
      !canStartCompetition
    ) {
      setErrorMessage(
        "世界維持不足：你的世界積分已耗盡，目前無法主動發起競技。"
      );

      return;
    }

    if (
      !opponentId
    ) {
      setErrorMessage(
        "請選擇挑戰對象。"
      );

      return;
    }

    if (
      !fighterId
    ) {
      setErrorMessage(
        "請選擇出戰附屬者。"
      );

      return;
    }

    setSubmitting(true);

    try {
      // =========================
      // 再次取得最新世界狀態
      // 避免頁面開啟後積分已變化
      // =========================

      const {
        data:
          statusData,
        error:
          statusError,
      } =
        await supabase.rpc(
          "get_my_world_status"
        );

      if (
        statusError
      ) {
        throw statusError;
      }

      if (
        Array.isArray(
          statusData
        ) &&
        statusData.length >
          0
      ) {
        const latest =
          statusData[0];

        if (
          !Boolean(
            latest.can_start_competition
          )
        ) {
          await loadWorldStatus();

          throw new Error(
            "世界維持不足：你的世界積分已耗盡，目前無法主動發起競技。"
          );
        }
      }

      // =========================
      // 建立競技
      // =========================

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "create_competition",
          {
            p_opponent_id:
              opponentId,

            p_challenger_subordinate_id:
              fighterId,
          }
        );

      if (
        error
      ) {
        throw error;
      }

      if (data) {
        router.push(
          `/arena/${data}`
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "建立競賽時發生錯誤。"
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

  function getStatusLabel(
    status: CompetitionStatus
  ) {
    if (
      status ===
      "pending"
    ) {
      return "等待接受";
    }

    if (
      status ===
      "accepted"
    ) {
      return "等待出戰";
    }

    if (
      status ===
      "playing"
    ) {
      return "競賽進行中";
    }

    if (
      status ===
      "completed"
    ) {
      return "已結束";
    }

    return "已取消";
  }

  function getWinRate(
    wins: number,
    matches: number
  ) {
    if (
      matches ===
      0
    ) {
      return "0%";
    }

    return `${Math.round(
      (
        wins /
        matches
      ) *
        100
    )}%`;
  }

  const pendingCompetitions =
    competitions.filter(
      (
        competition
      ) =>
        competition.status ===
        "pending"
    ).length;

  const playingCompetitions =
    competitions.filter(
      (
        competition
      ) =>
        competition.status ===
          "accepted" ||
        competition.status ===
          "playing"
    ).length;

  const completedCompetitions =
    competitions.filter(
      (
        competition
      ) =>
        competition.status ===
        "completed"
    ).length;

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取競技場…
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
              競技場
            </h1>

            <p className="mt-3 text-neutral-400">
              派遣你的直接附屬者與其他陣營進行競賽。
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/daily-missions"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              每日任務
            </Link>

            <Link
              href="/arena/leaderboard"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              競技排行榜
            </Link>

            <Link
              href="/dashboard"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回主頁
            </Link>

          </div>

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
              你的世界積分已耗盡，目前無法主動發起新的競技挑戰。
              你仍然可以查看既有競技、接受其他玩家向你提出的挑戰，以及繼續已經開始的競技。
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

        <section className="mb-6 grid gap-4 sm:grid-cols-4">

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">

            <p className="text-sm text-neutral-500">
              競技積分
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {
                currentProfile
                  ?.arena_points ??
                0
              }
            </p>

          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">

            <p className="text-sm text-neutral-500">
              等待接受
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {
                pendingCompetitions
              }{" "}
              場
            </p>

          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">

            <p className="text-sm text-neutral-500">
              進行中
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {
                playingCompetitions
              }{" "}
              場
            </p>

          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">

            <p className="text-sm text-neutral-500">
              已結束
            </p>

            <p className="mt-2 text-2xl font-semibold">
              {
                completedCompetitions
              }{" "}
              場
            </p>

          </div>

        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          <p className="text-sm text-neutral-500">
            我的競技戰績
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">

            <div className="rounded-xl bg-neutral-950 p-5">

              <p className="text-sm text-neutral-500">
                陣營戰績
              </p>

              <p className="mt-3 text-2xl font-semibold">
                {
                  stats.camp_wins
                }{" "}
                勝 /{" "}
                {
                  stats.camp_losses
                }{" "}
                敗
              </p>

              <p className="mt-3 text-sm text-neutral-400">
                勝率{" "}
                {getWinRate(
                  stats.camp_wins,
                  stats.camp_matches
                )}
              </p>

            </div>

            <div className="rounded-xl bg-neutral-950 p-5">

              <p className="text-sm text-neutral-500">
                個人出戰
              </p>

              <p className="mt-3 text-2xl font-semibold">
                {
                  stats.fighter_wins
                }{" "}
                勝 /{" "}
                {
                  stats.fighter_losses
                }{" "}
                敗
              </p>

              <p className="mt-3 text-sm text-neutral-400">

                回合勝{" "}
                {
                  stats.fighter_round_wins
                }

                {" ・ "}

                回合敗{" "}
                {
                  stats.fighter_round_losses
                }

                {" ・ "}

                平手{" "}
                {
                  stats.fighter_round_draws
                }

              </p>

            </div>

          </div>

        </section>

        <section
          className={`mb-6 rounded-2xl border p-6 ${
            worldMaintenanceInsufficient
              ? "border-red-900/60 bg-red-950/10"
              : "border-neutral-800 bg-neutral-900"
          }`}
        >

          <p
            className={`text-sm ${
              worldMaintenanceInsufficient
                ? "text-red-400"
                : "text-neutral-500"
            }`}
          >
            發起競賽
          </p>

          {worldMaintenanceInsufficient ? (

            <div className="mt-4 rounded-xl border border-red-900/50 bg-neutral-950 p-5">

              <p className="font-medium text-red-300">
                目前無法主動發起競技
              </p>

              <p className="mt-2 text-sm leading-6 text-neutral-400">
                世界積分恢復至 1 以上後，即可重新使用主動挑戰功能。
              </p>

            </div>

          ) : mySubordinates.length ===
            0 ? (

            <div className="mt-4 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              你目前沒有直接附屬者，因此無法發起競賽。
            </div>

          ) : (

            <div className="mt-5 grid gap-5 md:grid-cols-2">

              <select
                value={
                  opponentId
                }
                disabled={
                  !canStartCompetition ||
                  submitting
                }
                onChange={(
                  event
                ) =>
                  setOpponentId(
                    event
                      .target
                      .value
                  )
                }
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-40"
              >

                <option value="">
                  選擇挑戰對象
                </option>

                {availableOpponents.map(
                  (
                    profile
                  ) => (
                    <option
                      key={
                        profile.id
                      }
                      value={
                        profile.id
                      }
                    >
                      {
                        profile.nickname
                      }
                      ・
                      {formatSequence(
                        profile.join_sequence
                      )}
                    </option>
                  )
                )}

              </select>

              <select
                value={
                  fighterId
                }
                disabled={
                  !canStartCompetition ||
                  submitting
                }
                onChange={(
                  event
                ) =>
                  setFighterId(
                    event
                      .target
                      .value
                  )
                }
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-40"
              >

                <option value="">
                  選擇出戰附屬者
                </option>

                {mySubordinates.map(
                  (
                    profile
                  ) => (
                    <option
                      key={
                        profile.id
                      }
                      value={
                        profile.id
                      }
                    >
                      {
                        profile.nickname
                      }
                      ・
                      {formatSequence(
                        profile.join_sequence
                      )}
                    </option>
                  )
                )}

              </select>

              <button
                type="button"
                disabled={
                  submitting ||
                  !canStartCompetition
                }
                onClick={
                  handleCreateCompetition
                }
                className="rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40 md:col-span-2"
              >
                {submitting
                  ? "建立中…"
                  : "發出競賽挑戰"}
              </button>

            </div>

          )}

        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          <p className="text-sm text-neutral-500">
            我的競賽
          </p>

          <div className="mt-5 space-y-4">

            {competitions.length ===
            0 ? (

              <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
                目前沒有競賽紀錄。
              </div>

            ) : (

              competitions.map(
                (
                  competition
                ) => (

                  <Link
                    key={
                      competition.id
                    }
                    href={`/arena/${competition.id}`}
                    className="block rounded-xl bg-neutral-950 p-5 transition hover:bg-neutral-800"
                  >

                    <div className="flex flex-wrap justify-between gap-4">

                      <div>

                        <p className="font-medium">
                          {getProfile(
                            competition.challenger_id
                          )
                            ?.nickname ??
                            "未知玩家"}

                          {" VS "}

                          {getProfile(
                            competition.opponent_id
                          )
                            ?.nickname ??
                            "未知玩家"}
                        </p>

                        <p className="mt-2 text-sm text-neutral-500">
                          {formatDate(
                            competition.created_at
                          )}
                        </p>

                      </div>

                      <span className="text-sm text-neutral-400">
                        {getStatusLabel(
                          competition.status
                        )}
                      </span>

                    </div>

                    {competition.status ===
                      "completed" && (

                      <p className="mt-4 text-sm text-neutral-400">
                        比分{" "}
                        {
                          competition.challenger_score
                        }

                        {" : "}

                        {
                          competition.opponent_score
                        }
                      </p>

                    )}

                  </Link>

                )
              )

            )}

          </div>

        </section>

      </div>

    </main>
  );
}