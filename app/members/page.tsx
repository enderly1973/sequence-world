"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Member = {
  id: string;
  nickname: string;
  gender: "female" | "male" | "other";
  join_sequence: number;
  role:
    | "founder"
    | "administrator"
    | "manager"
    | "member";
  status: string;
  world_points: number;
  arena_points: number;
};

export default function MembersPage() {
  const router = useRouter();

  const [members, setMembers] =
    useState<Member[]>([]);

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadMembers();
  }, []);

  async function loadMembers() {
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
      // 完成每日任務
      // 查看世界成員
      // =========================

      const {
        error: missionError,
      } = await supabase.rpc(
        "complete_daily_mission",
        {
          p_mission_key:
            "view_members",
        }
      );

      if (missionError) {
        throw missionError;
      }

      // =========================
      // 載入世界成員
      // =========================

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
          arena_points
        `)
        .eq("status", "active")
        .order("join_sequence", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      setMembers(
        (data ?? []) as Member[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取世界成員時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredMembers =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      if (!keyword) {
        return members;
      }

      return members.filter(
        (member) => {
          const sequence =
            String(
              member.join_sequence
            ).padStart(6, "0");

          return (
            member.nickname
              .toLowerCase()
              .includes(keyword) ||
            sequence.includes(keyword)
          );
        }
      );
    }, [members, search]);

  function formatSequence(
    sequence: number
  ) {
    return String(sequence).padStart(
      6,
      "0"
    );
  }

  function getGenderLabel(
    gender: Member["gender"]
  ) {
    if (gender === "female") {
      return "女性";
    }

    if (gender === "male") {
      return "男性";
    }

    return "其他";
  }

  function getRoleLabel(
    role: Member["role"]
  ) {
    if (role === "founder") {
      return "創始成員";
    }

    if (
      role === "administrator"
    ) {
      return "系統管理者";
    }

    if (role === "manager") {
      return "管理成員";
    }

    return "一般成員";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界成員…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-5xl">

        {/* =========================
            Header
        ========================== */}

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              世界成員
            </h1>

            <p className="mt-3 text-neutral-400">
              查看目前加入世界的所有成員。
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
              href="/dashboard"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回主頁
            </Link>
          </div>
        </header>

        {/* =========================
            Error
        ========================== */}

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {/* =========================
            統計
        ========================== */}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              世界成員
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {members.length}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              女性成員
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {
                members.filter(
                  (member) =>
                    member.gender ===
                    "female"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              男性成員
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {
                members.filter(
                  (member) =>
                    member.gender ===
                    "male"
                ).length
              }
            </p>
          </div>
        </section>

        {/* =========================
            搜尋
        ========================== */}

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <label className="text-sm text-neutral-500">
            搜尋成員
          </label>

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="輸入暱稱或永久序號"
            className="mt-3 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-neutral-500"
          />
        </section>

        {/* =========================
            成員列表
        ========================== */}

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-sm text-neutral-500">
              成員列表
            </p>

            <p className="text-sm text-neutral-600">
              {
                filteredMembers.length
              }{" "}
              人
            </p>
          </div>

          {filteredMembers.length ===
          0 ? (
            <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
              找不到符合條件的成員。
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMembers.map(
                (member) => (
                  <Link
                    key={member.id}
                    href={`/members/${member.id}`}
                    className="block rounded-xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-neutral-600 hover:bg-neutral-900"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-5">
                      <div>
                        <p className="text-lg font-medium">
                          {
                            member.nickname
                          }
                        </p>

                        <p className="mt-2 text-sm text-neutral-500">
                          序號{" "}
                          {formatSequence(
                            member.join_sequence
                          )}
                          {" ・ "}
                          {getGenderLabel(
                            member.gender
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-5 text-sm">
                        <div className="text-right">
                          <p className="text-neutral-600">
                            世界積分
                          </p>

                          <p className="mt-1">
                            {
                              member.world_points
                            }
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-neutral-600">
                            競技積分
                          </p>

                          <p className="mt-1">
                            {
                              member.arena_points
                            }
                          </p>
                        </div>

                        <div className="rounded-full border border-neutral-700 px-3 py-1 text-neutral-400">
                          {getRoleLabel(
                            member.role
                          )}
                        </div>
                      </div>
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