"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DailyWorldCost = {
  cost_date: string;
  configured_points: number;
  deducted_points: number;
  balance_after: number;
  created_at: string;
};

type DailyWorldCostResult = {
  settled_days: number;
  total_deducted: number;
  today_configured_points: number;
  today_deducted_points: number;
  balance_after: number;
  today_settled: boolean;
};

export default function MaintenanceCostsPage() {
  const router = useRouter();

  const [
    records,
    setRecords,
  ] = useState<DailyWorldCost[]>([]);

  const [
    dailyCost,
    setDailyCost,
  ] =
    useState<DailyWorldCostResult | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

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
        data: { session },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        router.replace("/login");
        return;
      }

      const userId =
        session.user.id;

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          role,
          status
        `)
        .eq("id", userId)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (
        profile.role ===
          "administrator" ||
        profile.role ===
          "founder"
      ) {
        router.replace("/admin");
        return;
      }

      if (
        profile.status !==
        "active"
      ) {
        throw new Error(
          "目前帳號無法使用世界功能。"
        );
      }

      const {
        data: settleData,
        error: settleError,
      } = await supabase.rpc(
        "settle_daily_world_costs"
      );

      if (settleError) {
        throw settleError;
      }

      if (
        Array.isArray(
          settleData
        ) &&
        settleData.length >
          0
      ) {
        const result =
          settleData[0];

        setDailyCost({
          settled_days:
            Number(
              result.settled_days ??
                0
            ),

          total_deducted:
            Number(
              result.total_deducted ??
                0
            ),

          today_configured_points:
            Number(
              result.today_configured_points ??
                0
            ),

          today_deducted_points:
            Number(
              result.today_deducted_points ??
                0
            ),

          balance_after:
            Number(
              result.balance_after ??
                0
            ),

          today_settled:
            Boolean(
              result.today_settled
            ),
        });
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "get_my_daily_world_costs",
        {
          p_limit: 100,
        }
      );

      if (error) {
        throw error;
      }

      setRecords(
        (data ??
          []).map(
          (
            item: DailyWorldCost
          ) => ({
            cost_date:
              item.cost_date,

            configured_points:
              Number(
                item.configured_points ??
                  0
              ),

            deducted_points:
              Number(
                item.deducted_points ??
                  0
              ),

            balance_after:
              Number(
                item.balance_after ??
                  0
              ),

            created_at:
              item.created_at,
          })
        )
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取每日世界維持費紀錄時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const totalDeducted =
    useMemo(() => {
      return records.reduce(
        (
          total,
          record
        ) =>
          total +
          record.deducted_points,
        0
      );
    }, [records]);

  const normalSettlementDays =
    useMemo(() => {
      return records.filter(
        (record) =>
          record.deducted_points ===
            record.configured_points &&
          record.configured_points >
            0
      ).length;
    }, [records]);

  const insufficientBalanceDays =
    useMemo(() => {
      return records.filter(
        (record) =>
          record.deducted_points <
            record.configured_points &&
          record.configured_points >
            0
      ).length;
    }, [records]);

  function formatDate(
    value: string
  ) {
    const date =
      new Date(
        `${value}T00:00:00+08:00`
      );

    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        timeZone:
          "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      }
    ).format(date);
  }

  function formatCreatedAt(
    value: string
  ) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        timeZone:
          "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(
      new Date(value)
    );
  }

  function getStatusLabel(
    record: DailyWorldCost
  ) {
    if (
      record.configured_points ===
      0
    ) {
      return "免扣";
    }

    if (
      record.deducted_points ===
      record.configured_points
    ) {
      return "已結算";
    }

    if (
      record.deducted_points ===
      0
    ) {
      return "餘額不足";
    }

    return "部分扣除";
  }

  function getStatusClass(
    record: DailyWorldCost
  ) {
    if (
      record.configured_points ===
      0
    ) {
      return "border-neutral-700 bg-neutral-900 text-neutral-400";
    }

    if (
      record.deducted_points ===
      record.configured_points
    ) {
      return "border-emerald-900 bg-emerald-950/40 text-emerald-300";
    }

    return "border-amber-900 bg-amber-950/40 text-amber-300";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取維持費紀錄…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-6xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              每日世界維持費紀錄
            </h1>

            <p className="mt-3 max-w-2xl text-neutral-400">
              查看每日世界維持費的實際扣除紀錄與結算後世界積分。
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            返回玩家主頁
          </Link>
        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {dailyCost && (
          <section className="mb-6 rounded-2xl border border-amber-900/50 bg-amber-950/10 p-6">
            <p className="text-sm text-amber-400">
              今日維持費
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
                <p className="text-sm text-neutral-500">
                  今日標準費用
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {
                    dailyCost.today_configured_points
                  }
                </p>

                <p className="mt-1 text-xs text-neutral-500">
                  世界積分
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
                <p className="text-sm text-neutral-500">
                  今日實際扣除
                </p>

                <p className="mt-3 text-3xl font-semibold text-amber-300">
                  -
                  {
                    dailyCost.today_deducted_points
                  }
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
                <p className="text-sm text-neutral-500">
                  目前世界積分
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {
                    dailyCost.balance_after
                  }
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
                <p className="text-sm text-neutral-500">
                  今日狀態
                </p>

                <p className="mt-3 text-xl font-semibold">
                  {dailyCost
                    .today_settled
                    ? "已完成結算"
                    : "尚未結算"}
                </p>
              </div>

            </div>

            {dailyCost.settled_days >
              1 && (
              <div className="mt-5 rounded-xl border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200">
                本次登入補結算{" "}
                {
                  dailyCost.settled_days
                }{" "}
                天，共扣除{" "}
                {
                  dailyCost.total_deducted
                }{" "}
                世界積分。
              </div>
            )}
          </section>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              紀錄天數
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {records.length}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              累計扣除
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {totalDeducted}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              正常結算
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {normalSettlementDays}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              餘額不足紀錄
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {
                insufficientBalanceDays
              }
            </p>
          </div>

        </section>

        <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">

          <div className="border-b border-neutral-800 px-6 py-5">
            <p className="text-sm text-neutral-500">
              COST HISTORY
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              扣點明細
            </h2>
          </div>

          {records.length ===
          0 ? (
            <div className="p-10 text-center text-neutral-500">
              目前尚無每日世界維持費紀錄。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">

                <thead className="border-b border-neutral-800 bg-neutral-950/60 text-sm text-neutral-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">
                      日期
                    </th>

                    <th className="px-6 py-4 font-medium">
                      標準維持費
                    </th>

                    <th className="px-6 py-4 font-medium">
                      實際扣除
                    </th>

                    <th className="px-6 py-4 font-medium">
                      結算後積分
                    </th>

                    <th className="px-6 py-4 font-medium">
                      狀態
                    </th>

                    <th className="px-6 py-4 font-medium">
                      系統結算時間
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {records.map(
                    (record) => (
                      <tr
                        key={
                          record.cost_date
                        }
                        className="border-b border-neutral-800/70 last:border-b-0"
                      >
                        <td className="px-6 py-5 font-medium">
                          {formatDate(
                            record.cost_date
                          )}
                        </td>

                        <td className="px-6 py-5">
                          {
                            record.configured_points
                          }
                        </td>

                        <td className="px-6 py-5">
                          <span className="font-semibold text-amber-300">
                            -
                            {
                              record.deducted_points
                            }
                          </span>
                        </td>

                        <td className="px-6 py-5 font-semibold">
                          {
                            record.balance_after
                          }
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs ${getStatusClass(
                              record
                            )}`}
                          >
                            {getStatusLabel(
                              record
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-sm text-neutral-500">
                          {formatCreatedAt(
                            record.created_at
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>

              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold">
            維持費規則
          </h2>

          <div className="mt-4 space-y-2 text-sm leading-7 text-neutral-400">
            <p>
              每位一般玩家每天需支付世界維持費。
            </p>

            <p>
              每日費用由 Sequence World 系統設定決定。
            </p>

            <p>
              如果玩家多日未登入，系統會在下次登入時自動補結算尚未處理的日期。
            </p>

            <p>
              世界積分最低只會扣到 0，不會產生負數。
            </p>

            <p>
              每個玩家每個日期只會產生一筆維持費紀錄，不會重複扣款。
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}