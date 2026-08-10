"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  nickname: string;
  world_points: number;
  checkin_streak: number;
  last_checkin_date: string | null;
};

type CheckinLog = {
  id: string;
  checkin_date: string;
  streak: number;
  reward_points: number;
  created_at: string;
};

type CheckinResult = {
  streak: number;
  reward_points: number;
  total_world_points: number;
  checkin_date: string;
};

type MissionResult = {
  mission_key: string;
  reward_points: number;
  bonus_awarded: boolean;
  bonus_points: number;
  total_world_points: number;
  completed_count: number;
};

export default function CheckinPage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [logs, setLogs] =
    useState<CheckinLog[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [checkingIn, setCheckingIn] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

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
          world_points,
          checkin_streak,
          last_checkin_date
        `)
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      setProfile(
        profileData as Profile
      );

      const {
        data: logData,
        error: logError,
      } = await supabase
        .from("daily_checkins")
        .select(`
          id,
          checkin_date,
          streak,
          reward_points,
          created_at
        `)
        .eq("player_id", user.id)
        .order("checkin_date", {
          ascending: false,
        })
        .limit(10);

      if (logError) {
        throw logError;
      }

      setLogs(
        (logData ?? []) as CheckinLog[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取每日打卡資料時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckin() {
    if (checkingIn) {
      return;
    }

    setCheckingIn(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: checkinData,
        error: checkinError,
      } = await supabase.rpc(
        "daily_checkin"
      );

      if (checkinError) {
        throw checkinError;
      }

      const checkinResult =
        Array.isArray(checkinData) &&
        checkinData.length > 0
          ? (checkinData[0] as CheckinResult)
          : null;

      if (!checkinResult) {
        throw new Error(
          "沒有取得打卡結果。"
        );
      }

      const {
        data: missionData,
        error: missionError,
      } = await supabase.rpc(
        "complete_daily_mission",
        {
          p_mission_key:
            "daily_checkin",
        }
      );

      if (missionError) {
        throw missionError;
      }

      const missionResult =
        Array.isArray(missionData) &&
        missionData.length > 0
          ? (missionData[0] as MissionResult)
          : null;

      let message =
        `打卡成功！連續第 ${checkinResult.streak} 天，` +
        `獲得 ${checkinResult.reward_points} 世界積分。`;

      if (
        missionResult &&
        missionResult.reward_points > 0
      ) {
        message +=
          ` 每日任務完成，再獲得 ${missionResult.reward_points} 積分。`;
      }

      if (
        missionResult?.bonus_awarded
      ) {
        message +=
          ` 今日全部每日任務完成，額外獲得 ${missionResult.bonus_points} 積分。`;
      }

      setSuccessMessage(message);

      await loadPage();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "每日打卡失敗。"
      );
    } finally {
      setCheckingIn(false);
    }
  }

  function isTodayCheckedIn() {
    if (
      !profile?.last_checkin_date
    ) {
      return false;
    }

    const formatter =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Asia/Taipei",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      );

    const today =
      formatter.format(
        new Date()
      );

    return (
      profile.last_checkin_date ===
      today
    );
  }

  function formatDate(
    date: string
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
        `${date}T00:00:00+08:00`
      )
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取每日打卡…
      </main>
    );
  }

  const checked =
    isTodayCheckedIn();

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              每日打卡
            </h1>

            <p className="mt-3 text-neutral-400">
              每天回到世界，累積連續登入與世界積分。
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

        {profile && (
          <>
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <p className="text-sm text-neutral-500">
                  世界積分
                </p>

                <p className="mt-3 text-4xl font-semibold">
                  {
                    profile.world_points
                  }
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <p className="text-sm text-neutral-500">
                  連續打卡
                </p>

                <p className="mt-3 text-4xl font-semibold">
                  {
                    profile.checkin_streak
                  }

                  <span className="ml-2 text-lg text-neutral-500">
                    天
                  </span>
                </p>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center">
              <p className="text-sm text-neutral-500">
                今日打卡
              </p>

              {checked ? (
                <>
                  <p className="mt-4 text-2xl font-semibold">
                    今日已完成
                  </p>

                  <p className="mt-2 text-neutral-400">
                    明天再回來繼續累積連續打卡。
                  </p>

                  <button
                    type="button"
                    disabled
                    className="mt-6 cursor-not-allowed rounded-xl border border-neutral-800 px-8 py-4 text-neutral-600"
                  >
                    已打卡
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-4 text-2xl font-semibold">
                    今天還沒有打卡
                  </p>

                  <p className="mt-2 text-neutral-400">
                    完成今日打卡即可獲得世界積分，並完成每日任務。
                  </p>

                  <button
                    type="button"
                    disabled={
                      checkingIn
                    }
                    onClick={
                      handleCheckin
                    }
                    className="mt-6 rounded-xl bg-neutral-100 px-8 py-4 font-medium text-neutral-950 transition hover:bg-white disabled:opacity-50"
                  >
                    {checkingIn
                      ? "打卡中…"
                      : "今日打卡"}
                  </button>
                </>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <p className="text-sm text-neutral-500">
                連續打卡獎勵
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {[
                  [
                    "第1天",
                    "+5",
                  ],
                  [
                    "第2天",
                    "+6",
                  ],
                  [
                    "第3天",
                    "+7",
                  ],
                  [
                    "第4天",
                    "+8",
                  ],
                  [
                    "第5天",
                    "+9",
                  ],
                  [
                    "第6天",
                    "+10",
                  ],
                  [
                    "第7天+",
                    "+12",
                  ],
                ].map(
                  ([
                    day,
                    reward,
                  ]) => (
                    <div
                      key={day}
                      className="rounded-xl bg-neutral-950 p-4 text-center"
                    >
                      <p className="text-xs text-neutral-500">
                        {day}
                      </p>

                      <p className="mt-2 font-semibold">
                        {
                          reward
                        }
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <p className="text-sm text-neutral-500">
                最近打卡紀錄
              </p>

              {logs.length === 0 ? (
                <div className="mt-4 rounded-xl bg-neutral-950 p-5 text-neutral-400">
                  目前還沒有打卡紀錄。
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {logs.map(
                    (log) => (
                      <div
                        key={
                          log.id
                        }
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-neutral-950 p-4"
                      >
                        <div>
                          <p>
                            {formatDate(
                              log.checkin_date
                            )}
                          </p>

                          <p className="mt-1 text-sm text-neutral-500">
                            連續第{" "}
                            {
                              log.streak
                            }{" "}
                            天
                          </p>
                        </div>

                        <p className="font-medium">
                          +
                          {
                            log.reward_points
                          }{" "}
                          積分
                        </p>
                      </div>
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