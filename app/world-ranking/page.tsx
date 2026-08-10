"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  nickname: string;
  join_sequence: number;
  gender: "female" | "male" | "other";
  world_points: number;
  arena_points: number;
  checkin_streak: number;
  equipped_title_item_id: string | null;
};

type TitleItem = {
  id: string;
  name: string;
};

type RankingMode =
  | "world"
  | "streak"
  | "arena";

export default function WorldRankingPage() {
  const router = useRouter();

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [titles, setTitles] =
    useState<TitleItem[]>([]);

  const [mode, setMode] =
    useState<RankingMode>("world");

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadRanking();
  }, []);

  async function loadRanking() {
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

      // =========================
      // 玩家資料
      // =========================

      const {
        data: playerData,
        error: playerError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          nickname,
          join_sequence,
          gender,
          world_points,
          arena_points,
          checkin_streak,
          equipped_title_item_id
        `)
        .eq("status", "active");

      if (playerError) {
        throw playerError;
      }

      const loadedPlayers =
        (playerData ?? []) as Player[];

      setPlayers(loadedPlayers);

      // =========================
      // 取得排行榜中正在使用的稱號
      // =========================

      const titleIds = [
        ...new Set(
          loadedPlayers
            .map(
              (player) =>
                player.equipped_title_item_id
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            )
        ),
      ];

      if (titleIds.length === 0) {
        setTitles([]);
        return;
      }

      const {
        data: titleData,
        error: titleError,
      } = await supabase
        .from("world_shop_items")
        .select(`
          id,
          name
        `)
        .in("id", titleIds);

      if (titleError) {
        throw titleError;
      }

      setTitles(
        (titleData ?? []) as TitleItem[]
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

  const ranking = useMemo(() => {
    const result = [...players];

    if (mode === "world") {
      result.sort((a, b) => {
        if (
          b.world_points !==
          a.world_points
        ) {
          return (
            b.world_points -
            a.world_points
          );
        }

        return (
          a.join_sequence -
          b.join_sequence
        );
      });
    }

    if (mode === "streak") {
      result.sort((a, b) => {
        if (
          b.checkin_streak !==
          a.checkin_streak
        ) {
          return (
            b.checkin_streak -
            a.checkin_streak
          );
        }

        if (
          b.world_points !==
          a.world_points
        ) {
          return (
            b.world_points -
            a.world_points
          );
        }

        return (
          a.join_sequence -
          b.join_sequence
        );
      });
    }

    if (mode === "arena") {
      result.sort((a, b) => {
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
      });
    }

    return result;
  }, [players, mode]);

  function getTitle(
    player: Player
  ) {
    if (
      !player.equipped_title_item_id
    ) {
      return null;
    }

    return (
      titles.find(
        (title) =>
          title.id ===
          player.equipped_title_item_id
      ) ?? null
    );
  }

  function formatSequence(
    sequence: number
  ) {
    return String(sequence).padStart(
      6,
      "0"
    );
  }

  function getGenderLabel(
    gender: Player["gender"]
  ) {
    if (gender === "female") {
      return "女性";
    }

    if (gender === "male") {
      return "男性";
    }

    return "其他";
  }

  function getValue(
    player: Player
  ) {
    if (mode === "world") {
      return {
        label: "世界積分",
        value: player.world_points,
      };
    }

    if (mode === "streak") {
      return {
        label: "連續打卡",
        value: `${player.checkin_streak} 天`,
      };
    }

    return {
      label: "競技積分",
      value: player.arena_points,
    };
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界排行榜…
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
              世界排行榜
            </h1>

            <p className="mt-3 text-neutral-400">
              查看世界積分、連續打卡與競技排名。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              世界商店
            </Link>

            <Link
              href="/daily-missions"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              每日任務
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
                setMode("world")
              }
              className={
                mode === "world"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition hover:border-neutral-500 hover:text-white"
              }
            >
              世界積分
            </button>

            <button
              type="button"
              onClick={() =>
                setMode("streak")
              }
              className={
                mode === "streak"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition hover:border-neutral-500 hover:text-white"
              }
            >
              連續打卡
            </button>

            <button
              type="button"
              onClick={() =>
                setMode("arena")
              }
              className={
                mode === "arena"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition hover:border-neutral-500 hover:text-white"
              }
            >
              競技積分
            </button>

          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          {ranking.length === 0 ? (
            <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前還沒有玩家資料。
            </div>
          ) : (
            <div className="space-y-3">

              {ranking.map(
                (player, index) => {
                  const value =
                    getValue(player);

                  const title =
                    getTitle(player);

                  return (
                    <Link
                      key={player.id}
                      href={`/members/${player.id}`}
                      className="block rounded-xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-neutral-600 hover:bg-neutral-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-5">

                        <div className="flex items-center gap-5">

                          <div className="w-12 text-center">
                            <p
                              className={`text-2xl font-semibold ${
                                index === 0
                                  ? "text-amber-300"
                                  : index === 1
                                    ? "text-neutral-300"
                                    : index === 2
                                      ? "text-orange-400"
                                      : "text-neutral-600"
                              }`}
                            >
                              {index + 1}
                            </p>
                          </div>

                          <div>

                            {title && (
                              <p className="mb-1 text-xs font-medium text-amber-300">
                                「{title.name}」
                              </p>
                            )}

                            <p className="text-lg font-medium">
                              {player.nickname}
                            </p>

                            <p className="mt-1 text-sm text-neutral-500">
                              序號{" "}
                              {formatSequence(
                                player.join_sequence
                              )}
                              {" ・ "}
                              {getGenderLabel(
                                player.gender
                              )}
                            </p>

                          </div>
                        </div>

                        <div className="text-right">

                          <p className="text-sm text-neutral-500">
                            {value.label}
                          </p>

                          <p className="mt-1 text-2xl font-semibold">
                            {value.value}
                          </p>

                        </div>

                      </div>
                    </Link>
                  );
                }
              )}

            </div>
          )}

        </section>
      </div>
    </main>
  );
}