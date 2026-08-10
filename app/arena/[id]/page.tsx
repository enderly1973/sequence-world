"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CompetitionStatus =
  | "pending"
  | "accepted"
  | "playing"
  | "completed"
  | "cancelled";

type CompetitionMove =
  | "rock"
  | "paper"
  | "scissors";

type RoundWinner =
  | "challenger"
  | "opponent"
  | "draw"
  | null;

type Competition = {
  id: string;
  challenger_id: string;
  opponent_id: string;

  challenger_subordinate_id: string;
  opponent_subordinate_id: string | null;

  status: CompetitionStatus;

  challenger_score: number;
  opponent_score: number;

  winner_id: string | null;

  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

type Profile = {
  id: string;
  nickname: string;
  join_sequence: number;
  gender: "female" | "male" | "other";
};

type RelationRow = {
  subordinate_id: string;
};

type CompetitionRound = {
  round_number: number;

  challenger_move:
    | CompetitionMove
    | null;

  opponent_move:
    | CompetitionMove
    | null;

  winner_side: RoundWinner;

  resolved_at: string | null;

  challenger_submitted: boolean;
  opponent_submitted: boolean;
};

export default function CompetitionDetailPage() {
  const params = useParams();
  const router = useRouter();

  const competitionId =
    params.id as string;

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState("");

  const [
    competition,
    setCompetition,
  ] =
    useState<Competition | null>(
      null
    );

  const [
    profiles,
    setProfiles,
  ] = useState<Profile[]>([]);

  const [
    mySubordinates,
    setMySubordinates,
  ] =
    useState<Profile[]>([]);

  const [
    rounds,
    setRounds,
  ] =
    useState<CompetitionRound[]>(
      []
    );

  const [
    selectedFighterId,
    setSelectedFighterId,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [updating, setUpdating] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  useEffect(() => {
    void loadCompetition();
  }, [competitionId]);

  async function loadCompetition() {
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
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const {
        data: competitionData,
        error: competitionError,
      } = await supabase
        .from("competitions")
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
          created_at,
          accepted_at,
          started_at,
          completed_at,
          cancelled_at
        `)
        .eq("id", competitionId)
        .single();

      if (competitionError) {
        throw competitionError;
      }

      const loaded =
        competitionData as Competition;

      setCompetition(loaded);

      const ids = Array.from(
        new Set(
          [
            loaded.challenger_id,
            loaded.opponent_id,
            loaded.challenger_subordinate_id,
            loaded.opponent_subordinate_id,
          ].filter(
            Boolean
          ) as string[]
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
          join_sequence,
          gender
        `)
        .in("id", ids);

      if (profileError) {
        throw profileError;
      }

      setProfiles(
        (profileData ?? []) as Profile[]
      );

      if (
        loaded.opponent_id ===
          user.id &&
        loaded.status === "pending"
      ) {
        const {
          data: relationData,
          error: relationError,
        } = await supabase
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
            "status",
            "active"
          );

        if (relationError) {
          throw relationError;
        }

        const subordinateIds =
          (
            (relationData ??
              []) as RelationRow[]
          ).map(
            (item) =>
              item.subordinate_id
          );

        if (
          subordinateIds.length >
          0
        ) {
          const {
            data:
              subordinateProfiles,
            error:
              subordinateError,
          } = await supabase
            .from("profiles")
            .select(`
              id,
              nickname,
              join_sequence,
              gender
            `)
            .in(
              "id",
              subordinateIds
            )
            .order(
              "join_sequence",
              {
                ascending: true,
              }
            );

          if (
            subordinateError
          ) {
            throw subordinateError;
          }

          setMySubordinates(
            (subordinateProfiles ??
              []) as Profile[]
          );
        }
      }

      if (
        loaded.status !==
          "pending" &&
        loaded.status !==
          "cancelled"
      ) {
        const {
          data: roundData,
          error: roundError,
        } = await supabase.rpc(
          "get_competition_rounds",
          {
            p_competition_id:
              loaded.id,
          }
        );

        if (roundError) {
          throw roundError;
        }

        setRounds(
          (roundData ??
            []) as CompetitionRound[]
        );
      } else {
        setRounds([]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取競賽資料時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const challenger =
    useMemo(
      () =>
        profiles.find(
          (profile) =>
            profile.id ===
            competition?.challenger_id
        ) ?? null,
      [profiles, competition]
    );

  const opponent =
    useMemo(
      () =>
        profiles.find(
          (profile) =>
            profile.id ===
            competition?.opponent_id
        ) ?? null,
      [profiles, competition]
    );

  const challengerFighter =
    useMemo(
      () =>
        profiles.find(
          (profile) =>
            profile.id ===
            competition?.challenger_subordinate_id
        ) ?? null,
      [profiles, competition]
    );

  const opponentFighter =
    useMemo(
      () =>
        profiles.find(
          (profile) =>
            profile.id ===
            competition?.opponent_subordinate_id
        ) ?? null,
      [profiles, competition]
    );

  const isChallengerFighter =
    currentUserId ===
    competition?.challenger_subordinate_id;

  const isOpponentFighter =
    currentUserId ===
    competition?.opponent_subordinate_id;

  const isFighter =
    isChallengerFighter ||
    isOpponentFighter;

  const activeRound =
    rounds.find(
      (round) =>
        !round.resolved_at
    ) ?? null;

  const hasSubmitted =
    activeRound
      ? isChallengerFighter
        ? activeRound.challenger_submitted
        : isOpponentFighter
          ? activeRound.opponent_submitted
          : false
      : false;

  async function handleAccept() {
    if (
      !competition ||
      !selectedFighterId ||
      updating
    ) {
      return;
    }

    setUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } =
        await supabase.rpc(
          "accept_competition",
          {
            p_competition_id:
              competition.id,

            p_opponent_subordinate_id:
              selectedFighterId,
          }
        );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "已接受競賽挑戰，雙方出戰者已確定。"
      );

      await loadCompetition();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "接受競賽時發生錯誤。"
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleCancel() {
    if (
      !competition ||
      updating
    ) {
      return;
    }

    setUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } =
        await supabase.rpc(
          "cancel_competition",
          {
            p_competition_id:
              competition.id,
          }
        );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "競賽已取消。"
      );

      await loadCompetition();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "取消競賽時發生錯誤。"
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleMove(
    move: CompetitionMove
  ) {
    if (
      !competition ||
      updating
    ) {
      return;
    }

    setUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } =
        await supabase.rpc(
          "submit_competition_move",
          {
            p_competition_id:
              competition.id,
            p_move: move,
          }
        );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "出拳完成。"
      );

      await loadCompetition();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "出拳時發生錯誤。"
      );
    } finally {
      setUpdating(false);
    }
  }

  function formatSequence(
    sequence: number
  ) {
    return String(
      sequence
    ).padStart(6, "0");
  }

  function getStatusLabel(
    status: CompetitionStatus
  ) {
    if (
      status === "pending"
    ) {
      return "等待接受";
    }

    if (
      status === "accepted"
    ) {
      return "等待出戰";
    }

    if (
      status === "playing"
    ) {
      return "競賽進行中";
    }

    if (
      status === "completed"
    ) {
      return "競賽結束";
    }

    return "已取消";
  }

  function getMoveLabel(
    move:
      | CompetitionMove
      | null
  ) {
    if (move === "rock") {
      return "✊ 石頭";
    }

    if (move === "paper") {
      return "✋ 布";
    }

    if (
      move === "scissors"
    ) {
      return "✌️ 剪刀";
    }

    return "尚未公開";
  }

  function getWinnerLabel(
    winner: RoundWinner
  ) {
    if (
      winner === "challenger"
    ) {
      return "挑戰方勝";
    }

    if (
      winner === "opponent"
    ) {
      return "被挑戰方勝";
    }

    return "平手";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取競賽…
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
              競賽詳情
            </h1>
          </div>

          <Link
            href="/arena"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500"
          >
            返回競技場
          </Link>
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

        {competition && (
          <>
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-500">
                    陣營對戰
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold">
                    {challenger?.nickname ??
                      "未知玩家"}
                    {" VS "}
                    {opponent?.nickname ??
                      "未知玩家"}
                  </h2>
                </div>

                <span className="rounded-full border border-neutral-700 px-3 py-1 text-sm">
                  {getStatusLabel(
                    competition.status
                  )}
                </span>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-neutral-950 p-5">
                  <p className="text-sm text-neutral-500">
                    挑戰方
                  </p>

                  <p className="mt-2 text-lg font-medium">
                    {challenger?.nickname}
                  </p>

                  <div className="mt-5 border-t border-neutral-800 pt-4">
                    <p className="text-sm text-neutral-500">
                      出戰附屬者
                    </p>

                    <p className="mt-2 text-lg">
                      {challengerFighter?.nickname ??
                        "未知"}
                    </p>

                    {challengerFighter && (
                      <p className="mt-1 text-sm text-neutral-500">
                        序號{" "}
                        {formatSequence(
                          challengerFighter.join_sequence
                        )}
                      </p>
                    )}
                  </div>

                  <p className="mt-5 text-4xl font-semibold">
                    {
                      competition.challenger_score
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950 p-5">
                  <p className="text-sm text-neutral-500">
                    被挑戰方
                  </p>

                  <p className="mt-2 text-lg font-medium">
                    {opponent?.nickname}
                  </p>

                  <div className="mt-5 border-t border-neutral-800 pt-4">
                    <p className="text-sm text-neutral-500">
                      出戰附屬者
                    </p>

                    <p className="mt-2 text-lg">
                      {opponentFighter
                        ? opponentFighter.nickname
                        : "尚未選擇"}
                    </p>

                    {opponentFighter && (
                      <p className="mt-1 text-sm text-neutral-500">
                        序號{" "}
                        {formatSequence(
                          opponentFighter.join_sequence
                        )}
                      </p>
                    )}
                  </div>

                  <p className="mt-5 text-4xl font-semibold">
                    {
                      competition.opponent_score
                    }
                  </p>
                </div>
              </div>
            </section>

            {competition.status ===
              "pending" &&
              competition.opponent_id ===
                currentUserId && (
                <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                  <p className="text-sm text-neutral-500">
                    接受挑戰
                  </p>

                  <h3 className="mt-2 text-xl font-medium">
                    選擇你的出戰附屬者
                  </h3>

                  <select
                    value={
                      selectedFighterId
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedFighterId(
                        event.target
                          .value
                      )
                    }
                    className="mt-5 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3"
                  >
                    <option value="">
                      請選擇出戰者
                    </option>

                    {mySubordinates.map(
                      (member) => (
                        <option
                          key={
                            member.id
                          }
                          value={
                            member.id
                          }
                        >
                          {
                            member.nickname
                          }
                          ・
                          {formatSequence(
                            member.join_sequence
                          )}
                        </option>
                      )
                    )}
                  </select>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      disabled={
                        updating ||
                        !selectedFighterId
                      }
                      onClick={
                        handleAccept
                      }
                      className="rounded-lg bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950 disabled:opacity-50"
                    >
                      接受挑戰
                    </button>

                    <button
                      type="button"
                      disabled={
                        updating
                      }
                      onClick={
                        handleCancel
                      }
                      className="rounded-lg border border-neutral-700 px-5 py-3 text-sm"
                    >
                      拒絕挑戰
                    </button>
                  </div>
                </section>
              )}

            {competition.status ===
              "pending" &&
              competition.challenger_id ===
                currentUserId && (
                <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                  <p className="text-neutral-400">
                    正在等待對方接受挑戰。
                  </p>

                  <button
                    type="button"
                    disabled={updating}
                    onClick={
                      handleCancel
                    }
                    className="mt-4 rounded-lg border border-neutral-700 px-5 py-3 text-sm"
                  >
                    取消挑戰
                  </button>
                </section>
              )}

            {(competition.status ===
              "accepted" ||
              competition.status ===
                "playing") &&
              isFighter && (
                <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                  <p className="text-sm text-neutral-500">
                    猜拳競賽
                  </p>

                  <h3 className="mt-2 text-xl font-medium">
                    {activeRound
                      ? `第 ${activeRound.round_number} 回合`
                      : "下一回合"}
                  </h3>

                  {hasSubmitted ? (
                    <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
                      你已經出拳，正在等待對手。
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        disabled={
                          updating
                        }
                        onClick={() =>
                          handleMove(
                            "rock"
                          )
                        }
                        className="rounded-xl border border-neutral-700 bg-neutral-950 p-5 text-lg transition hover:border-neutral-400"
                      >
                        ✊ 石頭
                      </button>

                      <button
                        type="button"
                        disabled={
                          updating
                        }
                        onClick={() =>
                          handleMove(
                            "paper"
                          )
                        }
                        className="rounded-xl border border-neutral-700 bg-neutral-950 p-5 text-lg transition hover:border-neutral-400"
                      >
                        ✋ 布
                      </button>

                      <button
                        type="button"
                        disabled={
                          updating
                        }
                        onClick={() =>
                          handleMove(
                            "scissors"
                          )
                        }
                        className="rounded-xl border border-neutral-700 bg-neutral-950 p-5 text-lg transition hover:border-neutral-400"
                      >
                        ✌️ 剪刀
                      </button>
                    </div>
                  )}
                </section>
              )}

            {(competition.status ===
              "accepted" ||
              competition.status ===
                "playing") &&
              !isFighter && (
                <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                  <p className="text-sm text-neutral-500">
                    競賽進度
                  </p>

                  <p className="mt-2 text-neutral-300">
                    出戰附屬者正在進行競賽。
                  </p>
                </section>
              )}

            {rounds.filter(
              (round) =>
                round.resolved_at
            ).length > 0 && (
              <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <p className="text-sm text-neutral-500">
                  回合紀錄
                </p>

                <div className="mt-5 space-y-3">
                  {rounds
                    .filter(
                      (round) =>
                        round.resolved_at
                    )
                    .map(
                      (round) => (
                        <div
                          key={
                            round.round_number
                          }
                          className="rounded-xl bg-neutral-950 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <p className="font-medium">
                              第{" "}
                              {
                                round.round_number
                              }{" "}
                              回合
                            </p>

                            <span className="text-sm text-neutral-400">
                              {getWinnerLabel(
                                round.winner_side
                              )}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-neutral-600">
                                {
                                  challengerFighter?.nickname
                                }
                              </p>

                              <p className="mt-1">
                                {getMoveLabel(
                                  round.challenger_move
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-neutral-600">
                                {
                                  opponentFighter?.nickname
                                }
                              </p>

                              <p className="mt-1">
                                {getMoveLabel(
                                  round.opponent_move
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                </div>
              </section>
            )}

            {competition.status ===
              "completed" && (
                <section className="mt-6 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-6">
                  <p className="text-sm text-emerald-400">
                    競賽結束
                  </p>

                  <h3 className="mt-3 text-2xl font-semibold">
                    {competition.winner_id ===
                    competition.challenger_id
                      ? `${challenger?.nickname} 陣營獲勝`
                      : `${opponent?.nickname} 陣營獲勝`}
                  </h3>

                  <p className="mt-3 text-neutral-300">
                    最終比分{" "}
                    {
                      competition.challenger_score
                    }
                    {" : "}
                    {
                      competition.opponent_score
                    }
                  </p>
                </section>
              )}
          </>
        )}
      </div>
    </main>
  );
}