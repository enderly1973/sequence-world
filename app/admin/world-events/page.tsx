"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminProfile = {
  id: string;
  nickname: string;
  role:
    | "founder"
    | "administrator"
    | "manager"
    | "member";
  status: string;
};

type WorldEventSettings = {
  enabled: boolean;

  subsidy_probability: number;
  peaceful_probability: number;
  levy_probability: number;
  mission_bonus_probability: number;
  arena_bonus_probability: number;

  subsidy_min: number;
  subsidy_max: number;

  levy_min: number;
  levy_max: number;

  mission_bonus_points: number;
  arena_bonus_points: number;

  updated_at: string;
};

type WorldEventStats = {
  event_date: string;

  total_events: number;

  subsidy_count: number;
  peaceful_count: number;
  levy_count: number;
  mission_bonus_count: number;
  arena_bonus_count: number;

  subsidy_points: number;
  levy_points: number;

  mission_bonus_awarded: number;
  arena_bonus_awarded: number;

  net_world_points: number;

  subsidy_percentage: number;
  peaceful_percentage: number;
  levy_percentage: number;
  mission_bonus_percentage: number;
  arena_bonus_percentage: number;
};

export default function AdminWorldEventsPage() {
  const router = useRouter();

  const [
    admin,
    setAdmin,
  ] = useState<AdminProfile | null>(
    null
  );

  const [
    stats,
    setStats,
  ] = useState<WorldEventStats | null>(
    null
  );

  const [
    enabled,
    setEnabled,
  ] = useState(true);

  const [
    subsidyProbability,
    setSubsidyProbability,
  ] = useState(0);

  const [
    peacefulProbability,
    setPeacefulProbability,
  ] = useState(0);

  const [
    levyProbability,
    setLevyProbability,
  ] = useState(0);

  const [
    missionBonusProbability,
    setMissionBonusProbability,
  ] = useState(100);

  const [
    arenaBonusProbability,
    setArenaBonusProbability,
  ] = useState(0);

  const [
    subsidyMin,
    setSubsidyMin,
  ] = useState(2);

  const [
    subsidyMax,
    setSubsidyMax,
  ] = useState(5);

  const [
    levyMin,
    setLevyMin,
  ] = useState(1);

  const [
    levyMax,
    setLevyMax,
  ] = useState(3);

  const [
    missionBonusPoints,
    setMissionBonusPoints,
  ] = useState(1);

  const [
    arenaBonusPoints,
    setArenaBonusPoints,
  ] = useState(1);

  const [
    updatedAt,
    setUpdatedAt,
  ] = useState<string | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    refreshingStats,
    setRefreshingStats,
  ] = useState(false);

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

  const probabilityTotal =
    useMemo(
      () =>
        subsidyProbability
        + peacefulProbability
        + levyProbability
        + missionBonusProbability
        + arenaBonusProbability,
      [
        subsidyProbability,
        peacefulProbability,
        levyProbability,
        missionBonusProbability,
        arenaBonusProbability,
      ]
    );

  const probabilityValid =
    probabilityTotal === 100;

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
        data: profileData,
        error: profileError,
      } =
        await supabase
          .from("profiles")
          .select(`
            id,
            nickname,
            role,
            status
          `)
          .eq("id", user.id)
          .single();

      if (profileError) {
        throw profileError;
      }

      const loadedAdmin =
        profileData as AdminProfile;

      if (
        loadedAdmin.status !==
        "active"
      ) {
        throw new Error(
          "目前管理帳號無法使用。"
        );
      }

      if (
        loadedAdmin.role !==
          "administrator" &&
        loadedAdmin.role !==
          "founder"
      ) {
        router.replace("/dashboard");
        return;
      }

      setAdmin(loadedAdmin);

      await Promise.all([
        loadSettings(),
        loadStats(),
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取世界事件管理資料時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "admin_get_world_event_settings"
      );

    if (error) {
      throw error;
    }

    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {
      throw new Error(
        "找不到世界事件設定。"
      );
    }

    const settings =
      data[0] as WorldEventSettings;

    setEnabled(
      Boolean(settings.enabled)
    );

    setSubsidyProbability(
      Number(
        settings.subsidy_probability
      )
    );

    setPeacefulProbability(
      Number(
        settings.peaceful_probability
      )
    );

    setLevyProbability(
      Number(
        settings.levy_probability
      )
    );

    setMissionBonusProbability(
      Number(
        settings.mission_bonus_probability ??
          0
      )
    );

    setArenaBonusProbability(
      Number(
        settings.arena_bonus_probability ??
          0
      )
    );

    setSubsidyMin(
      Number(settings.subsidy_min)
    );

    setSubsidyMax(
      Number(settings.subsidy_max)
    );

    setLevyMin(
      Number(settings.levy_min)
    );

    setLevyMax(
      Number(settings.levy_max)
    );

    setMissionBonusPoints(
      Number(
        settings.mission_bonus_points ??
          1
      )
    );

    setArenaBonusPoints(
      Number(
        settings.arena_bonus_points ??
          1
      )
    );

    setUpdatedAt(
      settings.updated_at
    );
  }

  async function loadStats() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "admin_get_world_event_stats"
      );

    if (error) {
      throw error;
    }

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      const row =
        data[0];

      setStats({
        event_date:
          String(row.event_date),

        total_events:
          Number(
            row.total_events ?? 0
          ),

        subsidy_count:
          Number(
            row.subsidy_count ?? 0
          ),

        peaceful_count:
          Number(
            row.peaceful_count ?? 0
          ),

        levy_count:
          Number(
            row.levy_count ?? 0
          ),

        mission_bonus_count:
          Number(
            row.mission_bonus_count ?? 0
          ),

        arena_bonus_count:
          Number(
            row.arena_bonus_count ?? 0
          ),

        subsidy_points:
          Number(
            row.subsidy_points ?? 0
          ),

        levy_points:
          Number(
            row.levy_points ?? 0
          ),

        mission_bonus_awarded:
          Number(
            row.mission_bonus_awarded ??
              0
          ),

        arena_bonus_awarded:
          Number(
            row.arena_bonus_awarded ??
              0
          ),

        net_world_points:
          Number(
            row.net_world_points ?? 0
          ),

        subsidy_percentage:
          Number(
            row.subsidy_percentage ?? 0
          ),

        peaceful_percentage:
          Number(
            row.peaceful_percentage ?? 0
          ),

        levy_percentage:
          Number(
            row.levy_percentage ?? 0
          ),

        mission_bonus_percentage:
          Number(
            row.mission_bonus_percentage ??
              0
          ),

        arena_bonus_percentage:
          Number(
            row.arena_bonus_percentage ??
              0
          ),
      });
    }
  }

  async function handleRefreshStats() {
    if (refreshingStats) {
      return;
    }

    setRefreshingStats(true);
    setErrorMessage("");

    try {
      await loadStats();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "重新整理事件統計時發生錯誤。"
      );
    } finally {
      setRefreshingStats(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (!probabilityValid) {
      setErrorMessage(
        `五種事件機率合計必須為 100%，目前為 ${probabilityTotal}%。`
      );
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase.rpc(
          "admin_update_world_event_settings",
          {
            p_enabled:
              enabled,

            p_subsidy_probability:
              subsidyProbability,

            p_peaceful_probability:
              peacefulProbability,

            p_levy_probability:
              levyProbability,

            p_mission_bonus_probability:
              missionBonusProbability,

            p_arena_bonus_probability:
              arenaBonusProbability,

            p_subsidy_min:
              subsidyMin,

            p_subsidy_max:
              subsidyMax,

            p_levy_min:
              levyMin,

            p_levy_max:
              levyMax,

            p_mission_bonus_points:
              missionBonusPoints,

            p_arena_bonus_points:
              arenaBonusPoints,
          }
        );

      if (error) {
        throw error;
      }

      await loadSettings();

      setSuccessMessage(
        "世界事件設定已儲存。"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "儲存世界事件設定時發生錯誤。"
      );
    } finally {
      setSaving(false);
    }
  }

  function parseNumber(
    value: string
  ) {
    const number =
      Number(value);

    return Number.isNaN(number)
      ? 0
      : Math.trunc(number);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界事件管理…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-6xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD ADMIN
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              世界事件管理
            </h1>

            <p className="mt-3 text-neutral-400">
              控制每日世界事件機率、效果與實際發放狀況。
            </p>

            {admin && (
              <p className="mt-2 text-sm text-neutral-600">
                管理帳號：
                {admin.nickname}
              </p>
            )}
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
          >
            返回管理中心
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

        {stats && (
          <section className="mb-6 rounded-2xl border border-violet-900/50 bg-violet-950/10 p-6">

            <div className="flex flex-wrap items-start justify-between gap-5">

              <div>
                <p className="text-sm text-violet-400">
                  TODAY&apos;S EVENT ECONOMY
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  今日世界事件統計
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  handleRefreshStats
                }
                disabled={
                  refreshingStats
                }
                className="rounded-lg border border-violet-800 px-4 py-2 text-sm text-violet-300"
              >
                {refreshingStats
                  ? "更新中…"
                  : "重新整理統計"}
              </button>

            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <StatCard
                title="已生成事件"
                value={
                  stats.total_events
                }
              />

              <StatCard
                title="任務加成已發放"
                value={`+${stats.mission_bonus_awarded}`}
              />

              <StatCard
                title="競技加成已發放"
                value={`+${stats.arena_bonus_awarded}`}
              />

              <StatCard
                title="世界積分淨影響"
                value={
                  stats.net_world_points >
                  0
                    ? `+${stats.net_world_points}`
                    : stats.net_world_points
                }
              />

            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

              <EventCard
                title="世界補助"
                count={
                  stats.subsidy_count
                }
                percentage={
                  stats.subsidy_percentage
                }
              />

              <EventCard
                title="世界平靜"
                count={
                  stats.peaceful_count
                }
                percentage={
                  stats.peaceful_percentage
                }
              />

              <EventCard
                title="臨時徵收"
                count={
                  stats.levy_count
                }
                percentage={
                  stats.levy_percentage
                }
              />

              <EventCard
                title="每日任務加成"
                count={
                  stats.mission_bonus_count
                }
                percentage={
                  stats.mission_bonus_percentage
                }
              />

              <EventCard
                title="競技勝利加成"
                count={
                  stats.arena_bonus_count
                }
                percentage={
                  stats.arena_bonus_percentage
                }
              />

            </div>

          </section>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          <section className="rounded-2xl border border-emerald-900/60 bg-emerald-950/10 p-6">

            <div className="flex items-center justify-between gap-4">

              <div>
                <p className="text-sm text-emerald-400">
                  DAILY WORLD EVENT
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  每日世界事件
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEnabled(
                    !enabled
                  )
                }
                className="rounded-lg border border-neutral-700 px-5 py-3"
              >
                {enabled
                  ? "目前開啟"
                  : "目前關閉"}
              </button>

            </div>

          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

            <div className="flex justify-between gap-4">

              <div>
                <p className="text-sm text-neutral-500">
                  EVENT PROBABILITY
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  事件機率
                </h2>
              </div>

              <div
                className={`rounded-xl border px-5 py-3 ${
                  probabilityValid
                    ? "border-emerald-900 text-emerald-300"
                    : "border-red-900 text-red-300"
                }`}
              >
                合計{" "}
                {probabilityTotal}%
              </div>

            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

              <ProbabilityInput
                title="世界補助"
                value={
                  subsidyProbability
                }
                setValue={
                  setSubsidyProbability
                }
              />

              <ProbabilityInput
                title="世界平靜"
                value={
                  peacefulProbability
                }
                setValue={
                  setPeacefulProbability
                }
              />

              <ProbabilityInput
                title="臨時徵收"
                value={
                  levyProbability
                }
                setValue={
                  setLevyProbability
                }
              />

              <ProbabilityInput
                title="每日任務加成"
                value={
                  missionBonusProbability
                }
                setValue={
                  setMissionBonusProbability
                }
              />

              <ProbabilityInput
                title="競技勝利加成"
                value={
                  arenaBonusProbability
                }
                setValue={
                  setArenaBonusProbability
                }
              />

            </div>

          </section>

          <section className="rounded-2xl border border-sky-900/50 bg-sky-950/10 p-6">

            <p className="text-sm text-sky-400">
              DAILY MISSION BONUS
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              每日任務加成
            </h2>

            <NumberInput
              label="每項每日任務額外世界積分"
              value={
                missionBonusPoints
              }
              setValue={
                setMissionBonusPoints
              }
            />

          </section>

          <section className="rounded-2xl border border-violet-900/50 bg-violet-950/10 p-6">

            <p className="text-sm text-violet-400">
              ARENA WIN BONUS
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              競技勝利加成
            </h2>

            <p className="mt-3 text-sm text-neutral-400">
              抽到此事件的玩家，每次成為競技勝方主人或勝方出戰者時，可額外取得競技積分。
            </p>

            <NumberInput
              label="每次競技勝利額外競技積分"
              value={
                arenaBonusPoints
              }
              setValue={
                setArenaBonusPoints
              }
            />

          </section>

          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

            <button
              type="submit"
              disabled={
                saving ||
                !probabilityValid
              }
              className="w-full rounded-lg bg-neutral-100 px-6 py-3 font-medium text-neutral-950 disabled:opacity-40"
            >
              {saving
                ? "儲存中…"
                : "儲存世界事件設定"}
            </button>

          </section>

        </form>

      </div>
    </main>
  );

  function ProbabilityInput({
    title,
    value,
    setValue,
  }: {
    title: string;
    value: number;
    setValue: (
      value: number
    ) => void;
  }) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">

        <label className="text-sm text-neutral-400">
          {title}
        </label>

        <div className="mt-3 flex items-center gap-2">

          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(event) =>
              setValue(
                parseNumber(
                  event.target.value
                )
              )
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-3"
          />

          <span className="text-neutral-500">
            %
          </span>

        </div>

      </div>
    );
  }

  function NumberInput({
    label,
    value,
    setValue,
  }: {
    label: string;
    value: number;
    setValue: (
      value: number
    ) => void;
  }) {
    return (
      <div className="mt-5 max-w-md">

        <label className="text-sm text-neutral-400">
          {label}
        </label>

        <input
          type="number"
          min={0}
          value={value}
          onChange={(event) =>
            setValue(
              parseNumber(
                event.target.value
              )
            )
          }
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3"
        />

      </div>
    );
  }

  function StatCard({
    title,
    value,
  }: {
    title: string;
    value:
      | string
      | number;
  }) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
        <p className="text-sm text-neutral-500">
          {title}
        </p>

        <p className="mt-2 text-3xl font-semibold">
          {value}
        </p>
      </div>
    );
  }

  function EventCard({
    title,
    count,
    percentage,
  }: {
    title: string;
    count: number;
    percentage: number;
  }) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">

        <p className="font-medium">
          {title}
        </p>

        <p className="mt-2 text-2xl font-semibold">
          {count}
        </p>

        <p className="mt-1 text-sm text-neutral-500">
          {percentage}%
        </p>

      </div>
    );
  }
}