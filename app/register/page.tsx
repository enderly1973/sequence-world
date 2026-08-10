"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Gender = "female" | "male";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Gender>("female");
  const [acceptedRules, setAcceptedRules] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanNickname = nickname.trim();

    if (cleanNickname.length < 2 || cleanNickname.length > 30) {
      setErrorMessage("暱稱需為 2 至 30 個字元。");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("密碼至少需要 8 個字元。");
      return;
    }

    if (!acceptedRules) {
      setErrorMessage("請先閱讀並同意世界規則。");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            nickname: cleanNickname,
            gender,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("帳號建立失敗，請稍後再試。");
      }

      setEmail("");
      setPassword("");
      setNickname("");
      setGender("female");
      setAcceptedRules(false);

      if (data.session) {
        setSuccessMessage(
          "註冊成功。你的加入序號與初始身分已由系統建立。"
        );
      } else {
        setSuccessMessage(
          "註冊成功。請前往信箱完成驗證，再返回系統登入。"
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "註冊時發生未知錯誤。";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-12 text-neutral-100">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8">
          <p className="mb-2 text-sm tracking-[0.25em] text-neutral-500">
            SEQUENCE WORLD
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            進入序列世界
          </h1>

          <p className="mt-3 leading-7 text-neutral-400">
            每位成員都會依加入時間取得永久序號，並由系統安排初始身分與歸屬。
          </p>
        </div>

        <form
          onSubmit={handleRegister}
          className="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
        >
          <div>
            <label
              htmlFor="nickname"
              className="mb-2 block text-sm text-neutral-300"
            >
              暱稱
            </label>

            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              minLength={2}
              maxLength={30}
              autoComplete="nickname"
              required
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none transition focus:border-neutral-400"
              placeholder="輸入你的世界名稱"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm text-neutral-300"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none transition focus:border-neutral-400"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-neutral-300"
            >
              密碼
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 outline-none transition focus:border-neutral-400"
              placeholder="至少 8 個字元"
            />
          </div>

          <fieldset>
            <legend className="mb-3 text-sm text-neutral-300">
              性別
            </legend>

            <div className="grid grid-cols-2 gap-3">
              <label
                className={`cursor-pointer rounded-lg border p-4 transition ${
                  gender === "female"
                    ? "border-neutral-200 bg-neutral-800"
                    : "border-neutral-700 bg-neutral-950"
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={gender === "female"}
                  onChange={() => setGender("female")}
                  className="mr-2"
                />
                女性
              </label>

              <label
                className={`cursor-pointer rounded-lg border p-4 transition ${
                  gender === "male"
                    ? "border-neutral-200 bg-neutral-800"
                    : "border-neutral-700 bg-neutral-950"
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={gender === "male"}
                  onChange={() => setGender("male")}
                  className="mr-2"
                />
                男性
              </label>
            </div>
          </fieldset>

          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm leading-6 text-neutral-400">
            <p>基本規則：</p>
            <p className="mt-1">
  加入序號越小，代表加入時間越早。系統會依加入順序與身分規則，判定每位成員的初始階級與歸屬。
</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-neutral-300">
            <input
              type="checkbox"
              checked={acceptedRules}
              onChange={(event) =>
                setAcceptedRules(event.target.checked)
              }
              className="mt-1"
            />

            <span>
              我已閱讀並同意序列世界的加入順序、階級及歸屬規則。
            </span>
          </label>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300"
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300"
            >
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-neutral-100 px-4 py-3 font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "正在建立身分…" : "建立帳號並進入世界"}
          </button>

          <p className="text-center text-sm text-neutral-500">
            已有帳號？{" "}
            <Link
              href="/login"
              className="text-neutral-200 underline underline-offset-4"
            >
              前往登入
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}