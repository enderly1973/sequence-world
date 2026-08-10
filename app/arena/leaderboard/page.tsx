"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type LeaderboardRow = {
  player_id: string;
  nickname: string;
  join_sequence: number;
  arena_points: number;

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

type TabType =
  | "points"
  | "camp"
  | "fighter";

export default function ArenaLeaderboardPage() {
  const router = useRouter();

  const [
    leaderboard,
    setLeaderboard,
  ] = useState<LeaderboardRow[]>([]);

  const [
    tab,
    setTab,
  ] = useState<TabType>("points");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
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
        data,
        error,
      } = await supabase.rpc(
        "get_arena_leaderboard"
      );

      if (error) {
        throw error;
      }

      setLeaderboard(
        (data ?? []) as LeaderboardRow[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取排行榜時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const pointsRanking = useMemo(() => {
    return [...leaderboard].sort(
      (a, b) => {
        if (
          b.arena_points !==
          a.arena_points
        ) {
          return (
            b.arena_points -
            a.arena_points
          );
        }

        return (
          a.join_sequence -
          b.join_sequence
        );
      }
    );
  }, [leaderboard]);

  const campRanking = useMemo(() => {
    return leaderboard
      .filter(
        (row) =>
          row.camp_matches > 0
      )
      .sort((a, b) => {
        if (
          b.camp_wins !==
          a.camp_wins
        ) {
          return (
            b.camp_wins -
            a.camp_wins
          );
        }

        const rateA =
          a.camp_matches > 0
            ? a.camp_wins /
              a.camp_matches
            : 0;

        const rateB =
          b.camp_matches > 0
            ? b.camp_wins /
              b.camp_matches
            : 0;

        if (rateB !== rateA) {
          return rateB - rateA;
        }

        return (
          b.arena_points -
          a.arena_points
        );
      });
  }, [leaderboard]);

  const fighterRanking = useMemo(() => {
    return leaderboard
      .filter(
        (row) =>
          row.fighter_matches > 0
      )
      .sort((a, b) => {
        if (
          b.fighter_wins !==
          a.fighter_wins
        ) {
          return (
            b.fighter_wins -
            a.fighter_wins
          );
        }

        if (
          b.fighter_round_wins !==
          a.fighter_round_wins
        ) {
          return (
            b.fighter_round_wins -
            a.fighter_round_wins
          );
        }

        return (
          b.arena_points -
          a.arena_points
        );
      });
  }, [leaderboard]);

  function formatSequence(
    sequence: number
  ) {
    return String(
      sequence
    ).padStart(6, "0");
  }

  function getWinRate(
    wins: number,
    matches: number
  ) {
    if (matches === 0) {
      return "0%";
    }

    return `${Math.round(
      (wins / matches) * 100
    )}%`;
  }

  const rows =
    tab === "points"
      ? pointsRanking
      : tab === "camp"
        ? campRanking
        : fighterRanking;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取排行榜…
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
              競技排行榜
            </h1>

            <p className="mt-3 text-neutral-400">
              查看競技積分、陣營戰績與出戰者排名。
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/arena"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回競技場
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

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setTab("points")
              }
              className={
                tab === "points"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
              }
            >
              積分排行
            </button>

            <button
              type="button"
              onClick={() =>
                setTab("camp")
              }
              className={
                tab === "camp"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
              }
            >
              陣營排行
            </button>

            <button
              type="button"
              onClick={() =>
                setTab("fighter")
              }
              className={
                tab === "fighter"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
              }
            >
              附屬者排行
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          {rows.length === 0 ? (
            <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前還沒有足夠的競賽資料。
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map(
                (row, index) => (
                  <Link
                    key={row.player_id}
                    href={`/members/${row.player_id}`}
                    className="block rounded-xl bg-neutral-950 p-5 transition hover:bg-neutral-800"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-5">
                      <div className="flex items-center gap-5">
                        <div className="w-10 text-center text-2xl font-semibold text-neutral-500">
                          {index + 1}
                        </div>

                        <div>
                          <p className="text-lg font-medium">
                            {row.nickname}
                          </p>

                          <p className="mt-1 text-sm text-neutral-500">
                            序號{" "}
                            {formatSequence(
                              row.join_sequence
                            )}
                          </p>
                        </div>
                      </div>

                      {tab === "points" && (
                        <div className="text-right">
                          <p className="text-sm text-neutral-500">
                            競技積分
                          </p>

                          <p className="mt-1 text-2xl font-semibold">
                            {row.arena_points}
                          </p>
                        </div>
                      )}

                      {tab === "camp" && (
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div>
                            <p className="text-neutral-500">
                              戰績
                            </p>

                            <p className="mt-1">
                              {row.camp_wins}
                              勝 /{" "}
                              {row.camp_losses}
                              敗
                            </p>
                          </div>

                          <div>
                            <p className="text-neutral-500">
                              勝率
                            </p>

                            <p className="mt-1">
                              {getWinRate(
                                row.camp_wins,
                                row.camp_matches
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-neutral-500">
                              積分
                            </p>

                            <p className="mt-1">
                              {row.arena_points}
                            </p>
                          </div>
                        </div>
                      )}

                      {tab === "fighter" && (
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div>
                            <p className="text-neutral-500">
                              出戰戰績
                            </p>

                            <p className="mt-1">
                              {row.fighter_wins}
                              勝 /{" "}
                              {row.fighter_losses}
                              敗
                            </p>
                          </div>

                          <div>
                            <p className="text-neutral-500">
                              回合勝
                            </p>

                            <p className="mt-1">
                              {
                                row.fighter_round_wins
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-neutral-500">
                              平手
                            </p>

                            <p className="mt-1">
                              {
                                row.fighter_round_draws
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-neutral-500">
                              積分
                            </p>

                            <p className="mt-1">
                              {row.arena_points}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}