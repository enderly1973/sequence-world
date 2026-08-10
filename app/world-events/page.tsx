"use client";

import {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type WorldEvent = {
  event_id: string;
  event_date: string;

  event_type:
    | "world_subsidy"
    | "peaceful_day"
    | "temporary_levy"
    | "mission_bonus";

  title: string;
  description: string;

  points_change: number;
  effect_value: number;
  bonus_awarded: number;

  world_points_before: number;
  world_points_after: number;

  created_at: string;
};

export default function WorldEventsPage() {
  const router = useRouter();

  const [
    events,
    setEvents,
  ] = useState<WorldEvent[]>([]);

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
        data,
        error,
      } =
        await supabase.rpc(
          "get_my_daily_world_events",
          {
            p_limit: 50,
          }
        );

      if (error) {
        throw error;
      }

      setEvents(
        (data ?? []) as WorldEvent[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取世界事件紀錄時發生錯誤。"
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
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
      }
    ).format(
      new Date(
        `${value}T00:00:00+08:00`
      )
    );
  }

  function formatTime(
    value: string
  ) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        timeZone:
          "Asia/Taipei",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(
      new Date(value)
    );
  }

  function getEventClass(
    eventType:
      WorldEvent["event_type"]
  ) {
    if (
      eventType ===
      "world_subsidy"
    ) {
      return "border-emerald-900/60 bg-emerald-950/10";
    }

    if (
      eventType ===
      "temporary_levy"
    ) {
      return "border-red-900/60 bg-red-950/10";
    }

    if (
      eventType ===
      "mission_bonus"
    ) {
      return "border-sky-900/60 bg-sky-950/10";
    }

    return "border-neutral-800 bg-neutral-900";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界事件…
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
              世界事件
            </h1>

            <p className="mt-3 text-neutral-400">
              查看每天發生在你身上的世界變動。
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
          >
            返回主頁
          </Link>

        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          <p className="text-sm text-neutral-500">
            EVENT HISTORY
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            我的世界事件紀錄
          </h2>

          {events.length === 0 ? (
            <div className="mt-5 rounded-xl bg-neutral-950 p-6 text-neutral-500">
              目前還沒有世界事件。
            </div>
          ) : (
            <div className="mt-5 space-y-4">

              {events.map(
                (event) => (

                  <article
                    key={
                      event.event_id
                    }
                    className={`rounded-xl border p-5 ${getEventClass(
                      event.event_type
                    )}`}
                  >

                    <div className="flex flex-wrap items-start justify-between gap-5">

                      <div>

                        <p className="text-sm text-neutral-500">
                          {formatDate(
                            event.event_date
                          )}
                          {" ・ "}
                          {formatTime(
                            event.created_at
                          )}
                        </p>

                        <h3 className="mt-2 text-xl font-semibold">
                          {event.title}
                        </h3>

                        <p className="mt-2 leading-7 text-neutral-400">
                          {event.description}
                        </p>

                      </div>

                      {event.event_type ===
                      "mission_bonus" ? (

                        <div className="text-right">

                          <p className="text-3xl font-semibold text-sky-300">
                            +{event.effect_value}
                          </p>

                          <p className="mt-1 text-xs text-neutral-500">
                            每項每日任務
                          </p>

                        </div>

                      ) : (

                        <div className="text-right">

                          <p
                            className={`text-3xl font-semibold ${
                              event.points_change > 0
                                ? "text-emerald-300"
                                : event.points_change < 0
                                ? "text-red-300"
                                : "text-neutral-400"
                            }`}
                          >
                            {event.points_change > 0
                              ? `+${event.points_change}`
                              : event.points_change}
                          </p>

                          <p className="mt-1 text-xs text-neutral-500">
                            世界積分
                          </p>

                        </div>

                      )}

                    </div>

                    {event.event_type ===
                    "mission_bonus" ? (

                      <div className="mt-5 rounded-xl border border-sky-900/30 bg-neutral-950 p-4">

                        <p className="text-xs text-neutral-500">
                          今日透過任務加成已取得
                        </p>

                        <p className="mt-2 text-xl font-semibold text-sky-300">
                          +{event.bonus_awarded}
                          {" "}
                          世界積分
                        </p>

                      </div>

                    ) : (

                      <div className="mt-5 grid gap-3 border-t border-neutral-800/70 pt-4 sm:grid-cols-2">

                        <div>
                          <p className="text-xs text-neutral-600">
                            事件前
                          </p>
                          <p className="mt-1 font-medium">
                            {event.world_points_before}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-neutral-600">
                            事件後
                          </p>
                          <p className="mt-1 font-medium">
                            {event.world_points_after}
                          </p>
                        </div>

                      </div>

                    )}

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