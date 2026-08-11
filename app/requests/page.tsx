"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ProfileSummary = {
  id: string;
  nickname: string;
  gender: "female" | "male" | "other";
  join_sequence: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error !== null) {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      e.message,
      e.details,
      e.hint,
      e.code ? `錯誤代碼：${e.code}` : null,
    ].filter(
      (item): item is string =>
        typeof item === "string" && item.length > 0
    );

    if (parts.length > 0) return parts.join("｜");
  }

  return fallback;
}

export default function RequestsPage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] =
    useState<ProfileSummary | null>(null);

  const [superior, setSuperior] =
    useState<ProfileSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

      if (userError) throw userError;

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, nickname, gender, join_sequence")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const profile = profileData as ProfileSummary;
      setCurrentProfile(profile);

      const {
        data: relationData,
        error: relationError,
      } = await supabase
        .from("hierarchy_relations")
        .select("superior_id")
        .eq("subordinate_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (relationError) throw relationError;

      if (!relationData?.superior_id) {
        setSuperior(null);
        return;
      }

      const {
        data: superiorData,
        error: superiorError,
      } = await supabase
        .from("profiles")
        .select("id, nickname, gender, join_sequence")
        .eq("id", relationData.superior_id)
        .single();

      if (superiorError) throw superiorError;

      setSuperior(superiorData as ProfileSummary);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "讀取歸屬資料時發生錯誤。"
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRandomAssign() {
    if (assigning || superior) return;

    const confirmed = window.confirm(
      "確定要交由系統隨機分配上級嗎？\n\n系統會從目前符合資格且仍可接收從屬者的玩家中隨機配對。"
    );

    if (!confirmed) return;

    setAssigning(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: superiorId,
        error,
      } = await supabase.rpc("random_assign_superior");

      if (error) throw error;

      if (!superiorId) {
        throw new Error("系統沒有回傳分配結果。");
      }

      const {
        data: superiorData,
        error: superiorError,
      } = await supabase
        .from("profiles")
        .select("id, nickname, gender, join_sequence")
        .eq("id", superiorId)
        .single();

      if (superiorError) throw superiorError;

      const assignedSuperior = superiorData as ProfileSummary;

      setSuperior(assignedSuperior);

      setSuccessMessage(
        `系統已完成歸屬分配，你的新上級是「${assignedSuperior.nickname}」。`
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "系統分配上級時發生錯誤。"
        )
      );
    } finally {
      setAssigning(false);
    }
  }

  function formatSequence(sequence: number) {
    return String(sequence).padStart(6, "0");
  }

  function getGenderLabel(
    gender: ProfileSummary["gender"]
  ) {
    if (gender === "female") return "女性";
    if (gender === "male") return "男性";
    return "其他";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取歸屬資料…
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
              申請歸屬
            </h1>

            {currentProfile && (
              <p className="mt-3 text-neutral-400">
                {currentProfile.nickname}・序號{" "}
                {formatSequence(currentProfile.join_sequence)}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Link
              href="/hierarchy"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              階級關係
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
          <div className="mb-5 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-300">
            {successMessage}
          </div>
        )}

        {superior ? (
          <section className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-6">
            <p className="text-sm text-emerald-400">
              已完成歸屬
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              目前已有上級
            </h2>

            <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
              <p className="text-xl font-medium">
                {superior.nickname}
              </p>

              <p className="mt-2 text-sm text-neutral-500">
                序號{" "}
                {formatSequence(superior.join_sequence)}
                ・
                {getGenderLabel(superior.gender)}
              </p>
            </div>

            <p className="mt-4 text-sm leading-6 text-neutral-400">
              你目前已有有效歸屬關係，因此無法再次進行系統分配。
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/hierarchy"
                className="rounded-lg bg-neutral-100 px-5 py-3 font-medium text-neutral-950 transition hover:bg-white"
              >
                查看階級關係
              </Link>

              <Link
                href="/chat"
                className="rounded-lg border border-neutral-700 px-5 py-3 text-neutral-300 transition hover:border-neutral-500 hover:text-white"
              >
                前往主從聊天室
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-500">
              SYSTEM ASSIGNMENT
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              交由系統分配
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-400">
              目前沒有上級時，可以申請由系統進行歸屬分配。系統會從符合資格、目前仍接受新從屬者且尚有名額的玩家中隨機選擇一位。
            </p>

            <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
              <p className="font-medium">
                分配規則
              </p>

              <div className="mt-3 space-y-2 text-sm leading-6 text-neutral-500">
                <p>・不依加入序號前後決定。</p>
                <p>・管理帳號不會參與一般玩家配對。</p>
                <p>・只會分配給目前願意接收新從屬者且仍有名額的玩家。</p>
                <p>・分配成功後立即建立正式歸屬關係。</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRandomAssign}
              disabled={assigning}
              className="mt-6 rounded-lg bg-neutral-100 px-6 py-3 font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {assigning
                ? "系統分配中…"
                : "申請系統分配"}
            </button>
          </section>
        )}

      </div>
    </main>
  );
}
