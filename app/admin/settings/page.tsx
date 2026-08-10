"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SettingCategory =
  | "daily"
  | "arena"
  | "hierarchy";

type WorldSetting = {
  setting_key: string;
  setting_value: number;
  label: string;
  description: string;
  category: SettingCategory;
  min_value: number;
  max_value: number;
  sort_order: number;
  updated_at: string;
};

type AdminProfile = {
  role:
    | "founder"
    | "administrator"
    | "manager"
    | "member";

  status: string;
};

export default function AdminSettingsPage() {
  const router = useRouter();

  const [
    settings,
    setSettings,
  ] = useState<WorldSetting[]>([]);

  const [
    values,
    setValues,
  ] = useState<
    Record<string, string>
  >({});

  const [
    category,
    setCategory,
  ] =
    useState<SettingCategory>(
      "daily"
    );

  const [
    processingKey,
    setProcessingKey,
  ] = useState<string | null>(
    null
  );

  const [loading, setLoading] =
    useState(true);

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
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          role,
          status
        `)
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      const profile =
        profileData as AdminProfile;

      if (
        profile.status !== "active"
      ) {
        await supabase.auth.signOut();

        router.replace("/login");
        return;
      }

      if (
        profile.role !==
          "administrator" &&
        profile.role !==
          "founder"
      ) {
        router.replace(
          "/dashboard"
        );
        return;
      }

      await loadSettings();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取世界設定時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    const {
      data,
      error,
    } = await supabase
      .from("world_settings")
      .select(`
        setting_key,
        setting_value,
        label,
        description,
        category,
        min_value,
        max_value,
        sort_order,
        updated_at
      `)
      .order("category", {
        ascending: true,
      })
      .order("sort_order", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    const loaded =
      (data ?? []) as WorldSetting[];

    setSettings(loaded);

    const initialValues:
      Record<string, string> = {};

    loaded.forEach((setting) => {
      initialValues[
        setting.setting_key
      ] = String(
        setting.setting_value
      );
    });

    setValues(
      initialValues
    );
  }

  const visibleSettings =
    useMemo(
      () =>
        settings.filter(
          (setting) =>
            setting.category ===
            category
        ),
      [settings, category]
    );

  async function handleSave(
    setting: WorldSetting
  ) {
    if (processingKey) {
      return;
    }

    const rawValue =
      values[
        setting.setting_key
      ];

    const newValue =
      Number(rawValue);

    if (
      !Number.isInteger(
        newValue
      )
    ) {
      setErrorMessage(
        "設定值必須是整數。"
      );
      return;
    }

    if (
      newValue <
        setting.min_value ||
      newValue >
        setting.max_value
    ) {
      setErrorMessage(
        `「${setting.label}」必須介於 ${setting.min_value} 到 ${setting.max_value} 之間。`
      );
      return;
    }

    setProcessingKey(
      setting.setting_key
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        error,
      } = await supabase.rpc(
        "admin_update_world_setting",
        {
          p_setting_key:
            setting.setting_key,

          p_setting_value:
            newValue,
        }
      );

      if (error) {
        throw error;
      }

      setSuccessMessage(
        `「${setting.label}」已更新為 ${newValue}。`
      );

      await loadSettings();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "更新世界設定時發生錯誤。"
      );
    } finally {
      setProcessingKey(null);
    }
  }

  function getCategoryLabel(
    value: SettingCategory
  ) {
    if (value === "daily") {
      return "每日系統";
    }

    if (value === "arena") {
      return "競技系統";
    }

    return "階級系統";
  }

  function getUnit(
    setting: WorldSetting
  ) {
    if (
      setting.setting_key ===
      "default_subordinate_limit"
    ) {
      return "人";
    }

    if (
      setting.category ===
      "arena"
    ) {
      return "競技積分";
    }

    return "世界積分";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界設定…
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
              世界設定
            </h1>

            <p className="mt-3 text-neutral-400">
              管理世界中的獎勵與系統參數。
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

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-emerald-300">
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="flex flex-wrap gap-2">

            {(
              [
                "daily",
                "arena",
                "hierarchy",
              ] as SettingCategory[]
            ).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setCategory(
                    value
                  )
                }
                className={
                  category === value
                    ? "rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-950"
                    : "rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition hover:border-neutral-500 hover:text-white"
                }
              >
                {getCategoryLabel(
                  value
                )}
              </button>
            ))}

          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

          <div className="mb-6">
            <p className="text-sm text-neutral-500">
              WORLD RULES
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              {getCategoryLabel(
                category
              )}
            </h2>
          </div>

          <div className="space-y-4">

            {visibleSettings.map(
              (setting) => {
                const changed =
                  values[
                    setting.setting_key
                  ] !==
                  String(
                    setting.setting_value
                  );

                return (
                  <article
                    key={
                      setting.setting_key
                    }
                    className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
                  >
                    <div className="grid gap-5 md:grid-cols-[1fr_240px] md:items-center">

                      <div>
                        <p className="text-lg font-medium">
                          {setting.label}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-neutral-400">
                          {
                            setting.description
                          }
                        </p>

                        <p className="mt-3 text-xs text-neutral-600">
                          可設定範圍：
                          {" "}
                          {setting.min_value}
                          {" ～ "}
                          {setting.max_value}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">

                          <input
                            type="number"
                            min={
                              setting.min_value
                            }
                            max={
                              setting.max_value
                            }
                            step="1"
                            value={
                              values[
                                setting
                                  .setting_key
                              ] ?? ""
                            }
                            onChange={(
                              event
                            ) =>
                              setValues(
                                (
                                  current
                                ) => ({
                                  ...current,

                                  [setting.setting_key]:
                                    event
                                      .target
                                      .value,
                                })
                              )
                            }
                            className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-xl font-semibold outline-none focus:border-neutral-500"
                          />

                          <span className="whitespace-nowrap text-xs text-neutral-500">
                            {getUnit(
                              setting
                            )}
                          </span>

                        </div>

                        <button
                          type="button"
                          disabled={
                            !changed ||
                            processingKey !==
                              null
                          }
                          onClick={() =>
                            handleSave(
                              setting
                            )
                          }
                          className={`mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                            changed
                              ? "bg-neutral-100 text-neutral-950 hover:bg-white"
                              : "border border-neutral-800 text-neutral-600"
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {processingKey ===
                          setting.setting_key
                            ? "儲存中…"
                            : changed
                              ? "儲存變更"
                              : "目前設定"}
                        </button>

                      </div>

                    </div>
                  </article>
                );
              }
            )}

          </div>

        </section>

        <section className="mt-6 rounded-2xl border border-amber-900/40 bg-amber-950/10 p-5">
          <p className="text-sm font-medium text-amber-300">
            設定系統已建立
          </p>

          <p className="mt-2 text-sm leading-6 text-neutral-400">
            目前可以在後台修改數值。下一步會把每日任務與競技獎勵函數改成直接讀取這些設定，之後修改數字就會真正立即影響遊戲。
          </p>
        </section>

      </div>
    </main>
  );
}