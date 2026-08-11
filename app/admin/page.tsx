"use client";

import {
  useEffect,
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

type AdminStats = {
  players: number;
  announcements: number;
  activeAnnouncements: number;
  auditLogs: number;
};

type WorldEventSettings = {
  enabled: boolean;

  subsidy_probability: number;
  peaceful_probability: number;
  levy_probability: number;
  mission_bonus_probability: number;
};

type WorldEventStats = {
  total_events: number;

  subsidy_count: number;
  peaceful_count: number;
  levy_count: number;
  mission_bonus_count: number;

  mission_bonus_awarded: number;

  net_points: number;
};

export default function AdminPage() {
  const router =
    useRouter();

  const [
    profile,
    setProfile,
  ] =
    useState<AdminProfile | null>(
      null
    );

  const [
    stats,
    setStats,
  ] =
    useState<AdminStats>({
      players: 0,
      announcements: 0,
      activeAnnouncements: 0,
      auditLogs: 0,
    });

  const [
    worldEventSettings,
    setWorldEventSettings,
  ] =
    useState<WorldEventSettings | null>(
      null
    );

  const [
    worldEventStats,
    setWorldEventStats,
  ] =
    useState<WorldEventStats | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadAdmin();
  }, []);

  async function loadAdmin() {
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

      const loadedProfile =
        profileData as AdminProfile;

      if (
        loadedProfile.status !==
        "active"
      ) {
        await supabase.auth.signOut();

        router.replace("/login");
        return;
      }

      if (
        loadedProfile.role !==
          "administrator" &&
        loadedProfile.role !==
          "founder"
      ) {
        router.replace("/dashboard");
        return;
      }

      setProfile(
        loadedProfile
      );

      await Promise.all([
        loadStats(),
        loadWorldEventSummary(),
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取管理後台時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    const [
      playerResult,
      announcementResult,
      activeAnnouncementResult,
      auditResult,
    ] =
      await Promise.all([

        supabase
          .from("profiles")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("status", "active")
          .not(
            "role",
            "in",
            "(administrator,founder)"
          ),

        supabase
          .from(
            "world_announcements"
          )
          .select("*", {
            count: "exact",
            head: true,
          }),

        supabase
          .from(
            "world_announcements"
          )
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq(
            "is_active",
            true
          ),

        supabase
          .from(
            "admin_audit_logs"
          )
          .select("*", {
            count: "exact",
            head: true,
          }),
      ]);

    setStats({
      players:
        playerResult.count ??
        0,

      announcements:
        announcementResult.count ??
        0,

      activeAnnouncements:
        activeAnnouncementResult.count ??
        0,

      auditLogs:
        auditResult.count ??
        0,
    });
  }

  async function loadWorldEventSummary() {
    const [
      settingsResult,
      statsResult,
    ] =
      await Promise.all([

        supabase.rpc(
          "admin_get_world_event_settings"
        ),

        supabase.rpc(
          "admin_get_world_event_stats"
        ),

      ]);

    if (settingsResult.error) {
      throw settingsResult.error;
    }

    if (statsResult.error) {
      throw statsResult.error;
    }

    if (
      Array.isArray(
        settingsResult.data
      ) &&
      settingsResult.data.length >
        0
    ) {
      const row =
        settingsResult.data[0];

      setWorldEventSettings({
        enabled:
          Boolean(
            row.enabled
          ),

        subsidy_probability:
          Number(
            row.subsidy_probability ??
              0
          ),

        peaceful_probability:
          Number(
            row.peaceful_probability ??
              0
          ),

        levy_probability:
          Number(
            row.levy_probability ??
              0
          ),

        mission_bonus_probability:
          Number(
            row.mission_bonus_probability ??
              0
          ),
      });
    }

    if (
      Array.isArray(
        statsResult.data
      ) &&
      statsResult.data.length >
        0
    ) {
      const row =
        statsResult.data[0];

      setWorldEventStats({
        total_events:
          Number(
            row.total_events ??
              0
          ),

        subsidy_count:
          Number(
            row.subsidy_count ??
              0
          ),

        peaceful_count:
          Number(
            row.peaceful_count ??
              0
          ),

        levy_count:
          Number(
            row.levy_count ??
              0
          ),

        mission_bonus_count:
          Number(
            row.mission_bonus_count ??
              0
          ),

        mission_bonus_awarded:
          Number(
            row.mission_bonus_awarded ??
              0
          ),

        net_points:
          Number(
            row.net_points ??
              0
          ),
      });
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  function formatNetPoints(
    value: number
  ) {
    if (value > 0) {
      return `+${value}`;
    }

    return String(value);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在進入管理後台…
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
              系統管理後台
            </h1>

            <p className="mt-3 text-neutral-400">
              {profile
                ? `管理員：${profile.nickname}`
                : "世界管理系統"}
            </p>
          </div>

          <button
            type="button"
            onClick={
              handleLogout
            }
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
          >
            登出
          </button>

        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-red-950 bg-red-950/10 p-6">
          <p className="text-sm text-red-400">
            管理帳號
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            已進入管理模式
          </h2>

          <p className="mt-3 text-sm text-neutral-400">
            此帳號不參與玩家階級、附屬、競技與一般世界活動。
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="世界玩家"
            value={stats.players}
          />

          <StatCard
            title="全部公告"
            value={
              stats.announcements
            }
          />

          <StatCard
            title="啟用公告"
            value={
              stats.activeAnnouncements
            }
          />

          <StatCard
            title="管理操作紀錄"
            value={
              stats.auditLogs
            }
          />

        </section>

        <section className="mt-8">

          <p className="text-sm text-neutral-500">
            WORLD SYSTEM
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            世界運行狀態
          </h2>

          <Link
            href="/admin/world-events"
            className="mt-5 block rounded-2xl border border-violet-900/60 bg-violet-950/10 p-6"
          >

            <div className="flex flex-wrap items-start justify-between gap-5">

              <div>
                <p className="text-sm font-medium text-violet-400">
                  DAILY WORLD EVENT
                </p>

                <h3 className="mt-2 text-2xl font-semibold">
                  世界事件管理
                </h3>

                <p className="mt-2 text-sm text-neutral-400">
                  管理事件開關、機率與世界事件效果。
                </p>
              </div>

              <span
                className={`rounded-full border px-4 py-2 text-sm ${
                  worldEventSettings
                    ?.enabled
                    ? "border-emerald-800 text-emerald-300"
                    : "border-red-800 text-red-300"
                }`}
              >
                {worldEventSettings
                  ?.enabled
                  ? "目前開啟"
                  : "目前關閉"}
              </span>

            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <MiniCard
                title="今日已生成"
                value={
                  worldEventStats
                    ?.total_events ??
                  0
                }
              />

              <MiniCard
                title="世界補助"
                value={
                  worldEventStats
                    ?.subsidy_count ??
                  0
                }
              />

              <MiniCard
                title="任務加成"
                value={
                  worldEventStats
                    ?.mission_bonus_count ??
                  0
                }
              />

              <MiniCard
                title="今日淨影響"
                value={formatNetPoints(
                  worldEventStats
                    ?.net_points ??
                    0
                )}
              />

            </div>

            {worldEventSettings && (
              <p className="mt-5 border-t border-neutral-800 pt-4 text-sm text-neutral-500">
                補助{" "}
                {worldEventSettings.subsidy_probability}%
                {" ・ "}
                平靜{" "}
                {worldEventSettings.peaceful_probability}%
                {" ・ "}
                徵收{" "}
                {worldEventSettings.levy_probability}%
                {" ・ "}
                任務加成{" "}
                {worldEventSettings.mission_bonus_probability}%
              </p>
            )}

          </Link>

        </section>

        <section className="mt-10">

          <p className="text-sm text-neutral-500">
            ADMIN TOOLS
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            管理工具
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">

            <AdminCard
              href="/admin/announcements"
              title="公告管理"
              text="發布、置頂、停用或重新啟用世界公告。"
            />

            <AdminCard
              href="/admin/players"
              title="玩家管理"
              text="搜尋玩家、查看積分並管理帳號狀態。"
            />

            <AdminCard
              href="/admin/chats"
              title="聊天室監督"
              text="查看世界中所有主從聊天室與對話紀錄。"
            />

            <AdminCard
  href="/admin/assignments"
  title="歸屬分配紀錄"
  text="查看主從關係的系統分配、建立與解除歷程。"
/>

            <AdminCard
              href="/admin/settings"
              title="世界設定"
              text="調整每日獎勵、競技積分與階級參數。"
            />

            <AdminCard
              href="/admin/world-events"
              title="世界事件管理"
              text="控制每日世界事件、任務加成與事件統計。"
            />

            <AdminCard
              href="/admin/logs"
              title="系統紀錄"
              text="查看設定修改、玩家管理與公告操作紀錄。"
            />

            <AdminCard
              href="/announcements"
              title="查看世界公告"
              text="查看一般玩家目前看到的公告內容。"
            />

          </div>

        </section>

      </div>

    </main>
  );

  function StatCard({
    title,
    value,
  }: {
    title: string;
    value: number;
  }) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <p className="text-sm text-neutral-500">
          {title}
        </p>

        <p className="mt-3 text-3xl font-semibold">
          {value}
        </p>
      </div>
    );
  }

  function MiniCard({
    title,
    value,
  }: {
    title: string;
    value:
      | number
      | string;
  }) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <p className="text-xs text-neutral-500">
          {title}
        </p>

        <p className="mt-2 text-2xl font-semibold">
          {value}
        </p>
      </div>
    );
  }

  function AdminCard({
    href,
    title,
    text,
  }: {
    href: string;
    title: string;
    text: string;
  }) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 transition hover:border-neutral-600 hover:bg-neutral-800"
      >
        <p className="text-lg font-medium">
          {title}
        </p>

        <p className="mt-3 text-sm leading-6 text-neutral-400">
          {text}
        </p>
      </Link>
    );
  }
}