"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MissionKey =
  | "daily_checkin"
  | "view_world_tree"
  | "view_members"
  | "view_tasks"
  | "visit_arena";

type MissionStatus = {
  mission_key: MissionKey;
  completed: boolean;
  reward_points: number;
};

type Profile = {
  world_points: number;
};

const missionInfo: Record<
  MissionKey,
  {
    title: string;
    description: string;
    href: string;
  }
> = {
  daily_checkin: {
    title: "完成每日打卡",
    description:
      "完成今天的每日打卡。",
    href: "/checkin",
  },

  view_world_tree: {
    title: "查看世界階級圖",
    description:
      "查看目前世界的階級結構。",
    href: "/world-tree",
  },

  view_members: {
    title: "查看世界成員",
    description:
      "查看目前加入世界的成員。",
    href: "/members",
  },

  view_tasks: {
    title: "查看自己的任務",
    description:
      "進入任務中心查看收到的任務。",
    href: "/tasks",
  },

  visit_arena: {
    title: "進入競技場",
    description:
      "查看今天的競技場狀況。",
    href: "/arena",
  },
};

export default function DailyMissionsPage() {
  const router = useRouter();

  const [
    missions,
    setMissions,
  ] = useState<MissionStatus[]>([]);

  const [
    worldPoints,
    setWorldPoints,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
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
        data: missionData,
        error: missionError,
      } = await supabase.rpc(
        "get_my_daily_missions"
      );

      if (missionError) {
        throw missionError;
      }

      setMissions(
        (missionData ??
          []) as MissionStatus[]
      );

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("world_points")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      setWorldPoints(
        (
          profileData as Profile
        ).world_points
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取每日任務時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const completedCount =
    useMemo(
      () =>
        missions.filter(
          (mission) =>
            mission.completed
        ).length,
      [missions]
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取每日任務…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              每日任務
            </h1>

            <p className="mt-3 text-neutral-400">
              每天完成世界活動，累積世界積分。
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            返回主頁
          </Link>
        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-500">
              今日進度
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {completedCount}
              <span className="text-lg text-neutral-500">
                {" "}
                / 5
              </span>
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-500">
              世界積分
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {worldPoints}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-500">
              全部完成
            </p>

            <p className="mt-3 text-3xl font-semibold">
              +5
            </p>

            <p className="mt-1 text-sm text-neutral-500">
              額外積分
            </p>
          </div>
        </section>

        <section className="space-y-4">
          {missions.map(
            (mission) => {
              const info =
                missionInfo[
                  mission.mission_key
                ];

              return (
                <Link
                  key={
                    mission.mission_key
                  }
                  href={info.href}
                  className={`block rounded-2xl border p-6 transition ${
                    mission.completed
                      ? "border-emerald-900/50 bg-emerald-950/20"
                      : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-5">
                    <div>
                      <p className="text-lg font-medium">
                        {info.title}
                      </p>

                      <p className="mt-2 text-sm text-neutral-400">
                        {
                          info.description
                        }
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={
                          mission.completed
                            ? "font-medium text-emerald-400"
                            : "font-medium"
                        }
                      >
                        {mission.completed
                          ? "已完成"
                          : `+${mission.reward_points}`}
                      </p>

                      {!mission.completed && (
                        <p className="mt-1 text-xs text-neutral-500">
                          世界積分
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            }
          )}
        </section>

        {completedCount === 5 && (
          <section className="mt-6 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-6 text-center">
            <p className="text-sm text-emerald-400">
              DAILY COMPLETE
            </p>

            <p className="mt-2 text-2xl font-semibold">
              今日每日任務已全部完成
            </p>

            <p className="mt-2 text-neutral-400">
              今日額外獎勵已自動發放。
            </p>
          </section>
        )}
      </div>
    </main>
  );
}