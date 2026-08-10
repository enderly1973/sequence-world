"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserRole =
  | "founder"
  | "administrator"
  | "manager"
  | "member";

type Profile = {
  role: UserRole;
  status: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        return;
      }

      await redirectByRole(
        session.user.id
      );
    } finally {
      setCheckingSession(false);
    }
  }

  async function redirectByRole(
    userId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select(`
        role,
        status
      `)
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    const profile =
      data as Profile;

    if (
      profile.status !== "active"
    ) {
      await supabase.auth.signOut();

      throw new Error(
        "此帳號目前無法使用。"
      );
    }

    if (
      profile.role ===
        "administrator" ||
      profile.role ===
        "founder"
    ) {
      router.replace("/admin");
      router.refresh();
      return;
    }

    router.replace(
      "/dashboard"
    );

    router.refresh();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      if (!email.trim()) {
        throw new Error(
          "請輸入 Email。"
        );
      }

      if (!password) {
        throw new Error(
          "請輸入密碼。"
        );
      }

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email:
              email.trim(),

            password,
          }
        );

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error(
          "登入失敗。"
        );
      }

      await redirectByRole(
        data.user.id
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "登入時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在確認登入狀態…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="w-full max-w-md">

        <div className="mb-8 text-center">
          <p className="text-sm tracking-[0.3em] text-neutral-500">
            SEQUENCE WORLD
          </p>

          <h1 className="mt-4 text-3xl font-semibold">
            登入世界
          </h1>

          <p className="mt-3 text-sm leading-6 text-neutral-400">
            登入後將依帳號身分進入對應區域。
          </p>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="rounded-2xl border border-neutral-800 bg-neutral-900 p-7"
        >

          {errorMessage && (
            <div className="mb-5 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="text-sm text-neutral-400">
              Email
            </label>

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="輸入 Email"
              className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-neutral-500"
            />
          </div>

          <div className="mt-5">
            <label className="text-sm text-neutral-400">
              密碼
            </label>

            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="輸入密碼"
              className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-neutral-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-7 w-full rounded-xl bg-neutral-100 px-5 py-3 font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "登入中…"
              : "登入"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          還沒有帳號？{" "}
          <Link
            href="/register"
            className="text-neutral-300 transition hover:text-white"
          >
            建立玩家帳號
          </Link>
        </p>

      </div>
    </main>
  );
}