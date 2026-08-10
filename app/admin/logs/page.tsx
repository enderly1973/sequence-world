"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AuditLog = {
  id: string;

  actor_id: string | null;

  action_type: string;

  target_type: string;

  target_id: string | null;

  title: string;

  details: Record<
    string,
    unknown
  >;

  created_at: string;
};

type ActorProfile = {
  id: string;
  nickname: string;
};

type FilterType =
  | "all"
  | "settings"
  | "players"
  | "announcements";

export default function AdminLogsPage() {
  const router = useRouter();

  const [
    logs,
    setLogs,
  ] = useState<AuditLog[]>([]);

  const [
    actors,
    setActors,
  ] = useState<
    Record<string, string>
  >({});

  const [
    filter,
    setFilter,
  ] = useState<FilterType>(
    "all"
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

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          role,
          status
        `)
        .eq(
          "id",
          user.id
        )
        .single();

      if (profileError) {
        throw profileError;
      }

      if (
        profileData.status !==
        "active"
      ) {
        await supabase.auth.signOut();

        router.replace(
          "/login"
        );

        return;
      }

      if (
        profileData.role !==
          "administrator" &&
        profileData.role !==
          "founder"
      ) {
        router.replace(
          "/dashboard"
        );

        return;
      }

      await loadLogs();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取系統紀錄時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    const {
      data,
      error,
    } = await supabase
      .from("admin_audit_logs")
      .select(`
        id,
        actor_id,
        action_type,
        target_type,
        target_id,
        title,
        details,
        created_at
      `)
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(200);

    if (error) {
      throw error;
    }

    const loadedLogs =
      (data ??
        []) as AuditLog[];

    setLogs(
      loadedLogs
    );

    const actorIds =
      Array.from(
        new Set(
          loadedLogs
            .map(
              (log) =>
                log.actor_id
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        )
      );

    if (
      actorIds.length === 0
    ) {
      setActors({});
      return;
    }

    const {
      data: actorData,
      error: actorError,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        nickname
      `)
      .in(
        "id",
        actorIds
      );

    if (actorError) {
      throw actorError;
    }

    const map:
      Record<string, string> =
      {};

    (
      (actorData ??
        []) as ActorProfile[]
    ).forEach(
      (actor) => {
        map[actor.id] =
          actor.nickname;
      }
    );

    setActors(map);
  }

  const filteredLogs =
    useMemo(() => {
      if (filter === "all") {
        return logs;
      }

      if (
        filter ===
        "settings"
      ) {
        return logs.filter(
          (log) =>
            log.target_type ===
            "world_setting"
        );
      }

      if (
        filter === "players"
      ) {
        return logs.filter(
          (log) =>
            log.target_type ===
            "player"
        );
      }

      return logs.filter(
        (log) =>
          log.target_type ===
          "announcement"
      );
    }, [
      logs,
      filter,
    ]);

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

        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    ).format(
      new Date(value)
    );
  }

  function getActorName(
    actorId: string | null
  ) {
    if (!actorId) {
      return "系統";
    }

    return (
      actors[actorId] ??
      "未知管理員"
    );
  }

  function getCategoryLabel(
    log: AuditLog
  ) {
    if (
      log.target_type ===
      "world_setting"
    ) {
      return "世界設定";
    }

    if (
      log.target_type ===
      "player"
    ) {
      return "玩家管理";
    }

    if (
      log.target_type ===
      "announcement"
    ) {
      return "公告";
    }

    return "系統";
  }

  function renderDetails(
    log: AuditLog
  ) {
    if (
      log.action_type ===
      "world_setting_updated"
    ) {
      return (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-neutral-900 px-3 py-2 text-neutral-400">
            原設定{" "}
            {String(
              log.details
                .old_value ??
                "-"
            )}
          </span>

          <span className="text-neutral-600">
            →
          </span>

          <span className="rounded-lg bg-emerald-950/30 px-3 py-2 text-emerald-300">
            新設定{" "}
            {String(
              log.details
                .new_value ??
                "-"
            )}
          </span>
        </div>
      );
    }

    if (
      log.target_type ===
      "player"
    ) {
      return (
        <p className="mt-4 text-sm text-neutral-500">
          {String(
            log.details
              .old_status ??
              "-"
          )}
          {" → "}
          {String(
            log.details
              .new_status ??
              "-"
          )}
        </p>
      );
    }

    if (
      log.target_type ===
      "announcement"
    ) {
      return (
        <p className="mt-4 text-sm text-neutral-500">
          公告：
          {" "}
          {String(
            log.details
              .title ??
              ""
          )}
        </p>
      );
    }

    return null;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取系統紀錄…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-5xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">

          <div>
            <p className="text-sm tracking-[0.3em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <p className="mt-3 text-sm font-medium text-red-400">
              ADMINISTRATION
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              系統紀錄
            </h1>

            <p className="mt-3 text-neutral-400">
              查看管理員的重要操作與世界設定變更。
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            返回管理後台
          </Link>

        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              紀錄總數
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {logs.length}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              世界設定變更
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {
                logs.filter(
                  (log) =>
                    log.target_type ===
                    "world_setting"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              玩家管理操作
            </p>

            <p className="mt-3 text-3xl font-semibold">
              {
                logs.filter(
                  (log) =>
                    log.target_type ===
                    "player"
                ).length
              }
            </p>
          </div>

        </section>

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={() =>
                setFilter("all")
              }
              className={
                filter === "all"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
              }
            >
              全部
            </button>

            <button
              type="button"
              onClick={() =>
                setFilter(
                  "settings"
                )
              }
              className={
                filter ===
                "settings"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
              }
            >
              世界設定
            </button>

            <button
              type="button"
              onClick={() =>
                setFilter(
                  "players"
                )
              }
              className={
                filter ===
                "players"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
              }
            >
              玩家管理
            </button>

            <button
              type="button"
              onClick={() =>
                setFilter(
                  "announcements"
                )
              }
              className={
                filter ===
                "announcements"
                  ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                  : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400"
              }
            >
              公告
            </button>

          </div>

        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          {filteredLogs.length ===
          0 ? (
            <div className="rounded-xl bg-neutral-950 p-6 text-center text-neutral-500">
              目前沒有符合條件的操作紀錄。
            </div>
          ) : (
            <div className="space-y-4">

              {filteredLogs.map(
                (log) => (
                  <article
                    key={log.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-4">

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-400">
                            {getCategoryLabel(
                              log
                            )}
                          </span>

                          <span className="text-xs text-neutral-600">
                            {
                              getActorName(
                                log.actor_id
                              )
                            }
                          </span>

                        </div>

                        <h2 className="mt-3 text-lg font-semibold">
                          {log.title}
                        </h2>

                        {renderDetails(
                          log
                        )}

                      </div>

                      <p className="text-xs text-neutral-600">
                        {formatDate(
                          log.created_at
                        )}
                      </p>

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