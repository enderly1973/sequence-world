"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PlayerStatus =
  | "active"
  | "suspended"
  | "deleted";

type PlayerRole =
  | "founder"
  | "administrator"
  | "manager"
  | "member";

type Player = {
  id: string;
  nickname: string;
  gender: "female" | "male" | "other";
  join_sequence: number;
  role: PlayerRole;
  status: PlayerStatus;
  world_points: number;
  arena_points: number;
  checkin_streak: number;
  accepting_subordinates: boolean;
  subordinate_limit: number;
};

type FilterType =
  | "all"
  | "active"
  | "suspended";

export default function AdminPlayersPage() {
  const router = useRouter();

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<FilterType>("all");

  const [loading, setLoading] =
    useState(true);

  const [
    processingId,
    setProcessingId,
  ] = useState<string | null>(
    null
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

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
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: adminData,
        error: adminError,
      } = await supabase
        .from("profiles")
        .select("role,status")
        .eq("id", user.id)
        .single();

      if (adminError) {
        throw adminError;
      }

      if (
        adminData.status !==
          "active" ||
        (
          adminData.role !==
            "administrator" &&
          adminData.role !==
            "founder"
        )
      ) {
        router.replace(
          "/dashboard"
        );
        return;
      }

      await loadPlayers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取玩家管理頁時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayers() {
    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        nickname,
        gender,
        join_sequence,
        role,
        status,
        world_points,
        arena_points,
        checkin_streak,
        accepting_subordinates,
        subordinate_limit
      `)
      .not(
        "role",
        "in",
        "(administrator,founder)"
      )
      .order(
        "join_sequence",
        {
          ascending: true,
        }
      );

    if (error) {
      throw error;
    }

    setPlayers(
      (data ?? []) as Player[]
    );
  }

  const filteredPlayers =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase();

      return players.filter(
        (player) => {
          if (
            filter !== "all" &&
            player.status !== filter
          ) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          const sequence =
            String(
              player.join_sequence
            ).padStart(
              6,
              "0"
            );

          return (
            player.nickname
              .toLowerCase()
              .includes(keyword) ||
            sequence.includes(keyword)
          );
        }
      );
    }, [
      players,
      search,
      filter,
    ]);

  const activeCount =
    useMemo(
      () =>
        players.filter(
          (player) =>
            player.status ===
            "active"
        ).length,
      [players]
    );

  const suspendedCount =
    useMemo(
      () =>
        players.filter(
          (player) =>
            player.status ===
            "suspended"
        ).length,
      [players]
    );

  async function handleStatus(
    player: Player
  ) {
    if (processingId) {
      return;
    }

    const newStatus =
      player.status ===
      "active"
        ? "suspended"
        : "active";

    const confirmed =
      window.confirm(
        newStatus ===
          "suspended"
          ? `確定要停權「${player.nickname}」嗎？停權後目前階級關係會結束。`
          : `確定要恢復「${player.nickname}」嗎？`
      );

    if (!confirmed) {
      return;
    }

    setProcessingId(
      player.id
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "admin_set_player_status",
        {
          p_player_id:
            player.id,

          p_status:
            newStatus,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        newStatus ===
          "suspended"
          ? `「${player.nickname}」已停權。`
          : `「${player.nickname}」已恢復。`
      );

      await loadPlayers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "更新帳號狀態時發生錯誤。"
      );
    } finally {
      setProcessingId(null);
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
    gender: Player["gender"]
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

  function getRoleLabel(
    role: PlayerRole
  ) {
    if (
      role === "manager"
    ) {
      return "管理成員";
    }

    return "一般成員";
  }

  function getStatusLabel(
    status: PlayerStatus
  ) {
    if (
      status === "active"
    ) {
      return "正常";
    }

    if (
      status ===
      "suspended"
    ) {
      return "已停權";
    }

    return "已刪除";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取玩家管理…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-6xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.3em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <p className="mt-3 text-sm font-medium text-red-400">
              ADMINISTRATION
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              玩家管理
            </h1>

            <p className="mt-3 text-neutral-400">
              搜尋玩家、查看資料與管理帳號狀態。
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              管理後台
            </Link>

            <Link
              href="/members"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              玩家世界
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

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              玩家總數
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {players.length}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              正常帳號
            </p>

            <p className="mt-3 text-3xl font-semibold text-emerald-300">
              {activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              已停權
            </p>

            <p className="mt-3 text-3xl font-semibold text-red-300">
              {suspendedCount}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="搜尋暱稱或永久序號"
              className="rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
            />

            <div className="flex gap-2">

              <button
                type="button"
                onClick={() =>
                  setFilter("all")
                }
                className={
                  filter === "all"
                    ? "rounded-xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-950"
                    : "rounded-xl border border-neutral-700 px-4 py-3 text-sm text-neutral-400"
                }
              >
                全部
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilter(
                    "active"
                  )
                }
                className={
                  filter ===
                  "active"
                    ? "rounded-xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-950"
                    : "rounded-xl border border-neutral-700 px-4 py-3 text-sm text-neutral-400"
                }
              >
                正常
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilter(
                    "suspended"
                  )
                }
                className={
                  filter ===
                  "suspended"
                    ? "rounded-xl bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-950"
                    : "rounded-xl border border-neutral-700 px-4 py-3 text-sm text-neutral-400"
                }
              >
                停權
              </button>

            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          {filteredPlayers.length ===
          0 ? (
            <div className="rounded-xl bg-neutral-950 p-6 text-center text-neutral-500">
              找不到符合條件的玩家。
            </div>
          ) : (
            <div className="space-y-4">

              {filteredPlayers.map(
                (player) => (
                  <article
                    key={
                      player.id
                    }
                    className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-6">

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-3">

                          <Link
                            href={`/members/${player.id}`}
                            className="text-lg font-semibold transition hover:text-white"
                          >
                            {
                              player.nickname
                            }
                          </Link>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs ${
                              player.status ===
                              "active"
                                ? "border-emerald-900 text-emerald-300"
                                : "border-red-900 text-red-300"
                            }`}
                          >
                            {getStatusLabel(
                              player.status
                            )}
                          </span>

                        </div>

                        <p className="mt-2 text-sm text-neutral-500">
                          序號{" "}
                          {formatSequence(
                            player.join_sequence
                          )}
                          {" ・ "}
                          {getGenderLabel(
                            player.gender
                          )}
                          {" ・ "}
                          {getRoleLabel(
                            player.role
                          )}
                        </p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                          <div className="rounded-lg bg-neutral-900 p-3">
                            <p className="text-xs text-neutral-600">
                              世界積分
                            </p>

                            <p className="mt-1 text-lg font-medium">
                              {
                                player.world_points
                              }
                            </p>
                          </div>

                          <div className="rounded-lg bg-neutral-900 p-3">
                            <p className="text-xs text-neutral-600">
                              競技積分
                            </p>

                            <p className="mt-1 text-lg font-medium">
                              {
                                player.arena_points
                              }
                            </p>
                          </div>

                          <div className="rounded-lg bg-neutral-900 p-3">
                            <p className="text-xs text-neutral-600">
                              連續打卡
                            </p>

                            <p className="mt-1 text-lg font-medium">
                              {
                                player.checkin_streak
                              }{" "}
                              天
                            </p>
                          </div>

                          <div className="rounded-lg bg-neutral-900 p-3">
                            <p className="text-xs text-neutral-600">
                              接收附屬者
                            </p>

                            <p className="mt-1 text-lg font-medium">
                              {player.accepting_subordinates
                                ? `開啟 / ${player.subordinate_limit}`
                                : "關閉"}
                            </p>
                          </div>

                        </div>

                      </div>

                      <div>
                        {player.status ===
                        "active" ? (
                          <button
                            type="button"
                            disabled={
                              processingId ===
                              player.id
                            }
                            onClick={() =>
                              handleStatus(
                                player
                              )
                            }
                            className="rounded-xl border border-red-900 px-4 py-2 text-sm text-red-300 transition hover:bg-red-950/30 disabled:opacity-50"
                          >
                            {processingId ===
                            player.id
                              ? "處理中…"
                              : "停權"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              processingId ===
                              player.id
                            }
                            onClick={() =>
                              handleStatus(
                                player
                              )
                            }
                            className="rounded-xl border border-emerald-900 px-4 py-2 text-sm text-emerald-300 transition hover:bg-emerald-950/30 disabled:opacity-50"
                          >
                            {processingId ===
                            player.id
                              ? "處理中…"
                              : "恢復"}
                          </button>
                        )}
                      </div>

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