"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  nickname: string;
  world_points: number;
  arena_points: number;
  checkin_streak: number;
  last_checkin_date: string | null;
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

type DailyWorldCost = {
  cost_date: string;
  configured_points: number;
  deducted_points: number;
  balance_after: number;
  created_at: string;
};

type PermissionCardProps = {
  title: string;
  description: string;
  allowed: boolean;
  href: string;
};

export default function WorldStatusPage() {
  const router = useRouter();

  const [
    profile,
    setProfile,
  ] = useState<Profile | null>(
    null
  );

  const [
    worldStatus,
    setWorldStatus,
  ] = useState<WorldStatus | null>(
    null
  );

  const [
    latestCost,
    setLatestCost,
  ] = useState<DailyWorldCost | null>(
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
        router.replace(
          "/login"
        );

        return;
      }

      // =====================================
      // 先確保今日維持費已結算
      // =====================================

      const {
        error: settleError,
      } =
        await supabase.rpc(
          "settle_daily_world_costs"
        );

      if (settleError) {
        throw settleError;
      }

      // =====================================
      // 玩家資料
      // =====================================

      const {
        data: profileData,
        error: profileError,
      } =
        await supabase
          .from("profiles")
          .select(`
            id,
            nickname,
            world_points,
            arena_points,
            checkin_streak,
            last_checkin_date
          `)
          .eq(
            "id",
            user.id
          )
          .single();

      if (profileError) {
        throw profileError;
      }

      setProfile(
        profileData as Profile
      );

      // =====================================
      // 世界狀態
      // =====================================

      const {
        data: statusData,
        error: statusError,
      } =
        await supabase.rpc(
          "get_my_world_status"
        );

      if (statusError) {
        throw statusError;
      }

      if (
        Array.isArray(statusData) &&
        statusData.length > 0
      ) {
        const result =
          statusData[0];

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

      // =====================================
      // 最近一筆維持費
      // =====================================

      const {
        data: costData,
        error: costError,
      } =
        await supabase.rpc(
          "get_my_daily_world_costs",
          {
            p_limit: 1,
          }
        );

      if (costError) {
        throw costError;
      }

      if (
        Array.isArray(costData) &&
        costData.length > 0
      ) {
        setLatestCost(
          costData[0] as DailyWorldCost
        );
      } else {
        setLatestCost(
          null
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取世界狀態時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(
    value: string
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
      }
    ).format(
      new Date(
        `${value}T00:00:00+08:00`
      )
    );
  }

  function getStatusTitle() {
    if (
      worldStatus
        ?.maintenance_status ===
      "insufficient"
    ) {
      return "世界維持不足";
    }

    if (
      worldStatus
        ?.maintenance_status ===
      "inactive"
    ) {
      return "帳號受限制";
    }

    return "世界資格正常";
  }

  function getStatusDescription() {
    if (
      worldStatus
        ?.maintenance_status ===
      "insufficient"
    ) {
      return "目前世界積分已耗盡，你仍可進行取得積分的活動，但部分主動功能暫時停止。";
    }

    if (
      worldStatus
        ?.maintenance_status ===
      "inactive"
    ) {
      return "目前帳號狀態無法正常使用 Sequence World 功能。";
    }

    return "目前世界積分足以維持正常資格，你可以正常使用所有已開放的玩家功能。";
  }

  function PermissionCard({
    title,
    description,
    allowed,
    href,
  }: PermissionCardProps) {
    return (
      <Link
        href={href}
        className={`group block rounded-xl border p-5 transition ${
          allowed
            ? "border-emerald-900/50 bg-emerald-950/10 hover:border-emerald-700 hover:bg-emerald-950/20"
            : "border-red-900/50 bg-red-950/10 hover:border-red-700 hover:bg-red-950/20"
        }`}
      >
        <div className="flex items-start justify-between gap-4">

          <div>

            <p className="font-medium">
              {title}
            </p>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              {description}
            </p>

          </div>

          <div className="flex shrink-0 flex-col items-end gap-3">

            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                allowed
                  ? "border-emerald-800 text-emerald-300"
                  : "border-red-800 text-red-300"
              }`}
            >
              {allowed
                ? "可使用"
                : "暫停"}
            </span>

            <span className="text-xs text-neutral-600 transition group-hover:text-neutral-300">
              前往 →
            </span>

          </div>

        </div>
      </Link>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界狀態…
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
              世界狀態
            </h1>

            <p className="mt-3 text-neutral-400">
              查看你的世界資格、主動權限與每日維持狀況。
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

        {profile &&
          worldStatus && (
          <>

            {/* =====================================
                世界資格
            ===================================== */}

            <section
              className={`mb-6 rounded-2xl border p-6 ${
                worldStatus
                  .maintenance_status ===
                "insufficient"
                  ? "border-red-800 bg-red-950/20"
                  : "border-emerald-900/60 bg-emerald-950/10"
              }`}
            >

              <p
                className={`text-sm font-medium ${
                  worldStatus
                    .maintenance_status ===
                  "insufficient"
                    ? "text-red-400"
                    : "text-emerald-400"
                }`}
              >
                WORLD STATUS
              </p>

              <h2 className="mt-2 text-3xl font-semibold">
                {getStatusTitle()}
              </h2>

              <p className="mt-3 max-w-3xl leading-7 text-neutral-400">
                {getStatusDescription()}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">

                  <p className="text-sm text-neutral-500">
                    目前世界積分
                  </p>

                  <p className="mt-2 text-3xl font-semibold">
                    {
                      profile.world_points
                    }
                  </p>

                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">

                  <p className="text-sm text-neutral-500">
                    競技積分
                  </p>

                  <p className="mt-2 text-3xl font-semibold">
                    {
                      profile.arena_points
                    }
                  </p>

                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">

                  <p className="text-sm text-neutral-500">
                    世界資格
                  </p>

                  <p
                    className={`mt-2 text-xl font-semibold ${
                      worldStatus
                        .maintenance_status ===
                      "normal"
                        ? "text-emerald-300"
                        : "text-red-300"
                    }`}
                  >
                    {worldStatus
                      .maintenance_status ===
                    "normal"
                      ? "正常"
                      : "受限制"}
                  </p>

                </div>

              </div>

            </section>

            {/* =====================================
                世界權限
            ===================================== */}

            <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

              <p className="text-sm text-neutral-500">
                WORLD RIGHTS
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                我的世界權限
              </h2>

              <p className="mt-2 text-sm text-neutral-500">
                點選權限卡片即可前往對應功能。
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">

                <PermissionCard
                  title="取得世界積分"
                  description="每日打卡、每日任務與其他獎勵活動。"
                  allowed={
                    worldStatus.can_earn_points
                  }
                  href="/daily-missions"
                />

                <PermissionCard
                  title="使用世界積分"
                  description="在世界商店購買新的永久商品。"
                  allowed={
                    worldStatus.can_spend_points
                  }
                  href="/shop"
                />

                <PermissionCard
                  title="主動發起競技"
                  description="派遣直接從屬者向其他陣營提出競技挑戰。"
                  allowed={
                    worldStatus.can_start_competition
                  }
                  href="/arena"
                />

                <PermissionCard
                  title="主動發送任務"
                  description="向自己的直接從屬者建立新的任務。"
                  allowed={
                    worldStatus.can_send_task
                  }
                  href="/subordinates"
                />

              </div>

            </section>

            {/* =====================================
                維持費
            ===================================== */}

            <section className="mb-6 rounded-2xl border border-amber-900/50 bg-amber-950/10 p-6">

              <div className="flex flex-wrap items-start justify-between gap-5">

                <div>

                  <p className="text-sm text-amber-400">
                    WORLD MAINTENANCE
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold">
                    每日世界維持費
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-neutral-400">
                    Sequence World 每日會進行一次世界資格維持結算。
                    世界積分最低只會扣至 0，不會成為負數。
                  </p>

                </div>

                <Link
                  href="/maintenance-costs"
                  className="rounded-lg border border-amber-900/60 px-4 py-2 text-sm text-amber-300 transition hover:border-amber-700 hover:bg-amber-950/30"
                >
                  查看完整紀錄
                </Link>

              </div>

              {latestCost ? (

                <div className="mt-5 grid gap-4 sm:grid-cols-4">

                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">

                    <p className="text-xs text-neutral-500">
                      最近結算日期
                    </p>

                    <p className="mt-2 font-medium">
                      {formatDate(
                        latestCost.cost_date
                      )}
                    </p>

                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">

                    <p className="text-xs text-neutral-500">
                      標準維持費
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {
                        latestCost.configured_points
                      }
                    </p>

                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">

                    <p className="text-xs text-neutral-500">
                      實際扣除
                    </p>

                    <p className="mt-2 text-2xl font-semibold text-amber-300">
                      -
                      {
                        latestCost.deducted_points
                      }
                    </p>

                  </div>

                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">

                    <p className="text-xs text-neutral-500">
                      當次結算後
                    </p>

                    <p className="mt-2 text-2xl font-semibold">
                      {
                        latestCost.balance_after
                      }
                    </p>

                  </div>

                </div>

              ) : (

                <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-500">
                  尚無世界維持費紀錄。
                </div>

              )}

            </section>

            {/* =====================================
                世界維持不足恢復
            ===================================== */}

            {worldStatus
              .maintenance_status ===
              "insufficient" && (

              <section className="mb-6 rounded-2xl border border-emerald-900/60 bg-emerald-950/10 p-6">

                <p className="text-sm text-emerald-400">
                  WORLD RECOVERY
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  恢復世界資格
                </h2>

                <p className="mt-3 text-neutral-400">
                  世界積分恢復到 1 以上後，主動權會自動重新開放。
                </p>

                <div className="mt-5 flex flex-wrap gap-3">

                  <Link
                    href="/checkin"
                    className="rounded-lg bg-emerald-100 px-5 py-3 text-sm font-medium text-emerald-950 transition hover:bg-white"
                  >
                    每日打卡
                  </Link>

                  <Link
                    href="/daily-missions"
                    className="rounded-lg border border-emerald-800 px-5 py-3 text-sm text-emerald-300 transition hover:border-emerald-600"
                  >
                    每日任務
                  </Link>

                </div>

              </section>

            )}

            {/* =====================================
                快速入口
            ===================================== */}

            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

              <p className="text-sm text-neutral-500">
                QUICK ACCESS
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                世界功能
              </h2>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                <Link
                  href="/checkin"
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition hover:border-neutral-600"
                >
                  每日打卡
                </Link>

                <Link
                  href="/daily-missions"
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition hover:border-neutral-600"
                >
                  每日任務
                </Link>

                <Link
                  href="/shop"
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition hover:border-neutral-600"
                >
                  世界商店
                </Link>

                <Link
                  href="/arena"
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition hover:border-neutral-600"
                >
                  競技場
                </Link>

              </div>

            </section>

          </>
        )}

      </div>

    </main>
  );
}