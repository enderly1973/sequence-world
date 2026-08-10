"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MemberProfile = {
  id: string;
  nickname: string;
  gender: "female" | "male" | "other";
  join_sequence: number;

  role:
    | "founder"
    | "administrator"
    | "manager"
    | "member";

  status: string;

  world_points: number;
  arena_points: number;
  checkin_streak: number;

  equipped_title_item_id: string | null;
};

type Relation = {
  superior_id: string;
  subordinate_id: string;
  relation_type: string;
};

type BasicProfile = {
  id: string;
  nickname: string;
  join_sequence: number;
};

type TitleItem = {
  id: string;
  name: string;
  description: string;
};

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();

  const memberId =
    params.id as string;

  const [
    member,
    setMember,
  ] = useState<MemberProfile | null>(
    null
  );

  const [
    superior,
    setSuperior,
  ] = useState<BasicProfile | null>(
    null
  );

  const [
    subordinates,
    setSubordinates,
  ] = useState<BasicProfile[]>([]);

  const [
    title,
    setTitle,
  ] = useState<TitleItem | null>(
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
    void loadMember();
  }, [memberId]);

  async function loadMember() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: memberData,
        error: memberError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          nickname,
          gender,
          join_sequence,
          role,
          status,
          world_points,
          arena_points,
          checkin_streak,
          equipped_title_item_id
        `)
        .eq("id", memberId)
        .single();

      if (memberError) {
        throw memberError;
      }

      const loadedMember =
        memberData as MemberProfile;

      setMember(loadedMember);

      // =========================
      // 已裝備稱號
      // =========================

      if (
        loadedMember.equipped_title_item_id
      ) {
        const {
          data: titleData,
          error: titleError,
        } = await supabase
          .from("world_shop_items")
          .select(`
            id,
            name,
            description
          `)
          .eq(
            "id",
            loadedMember.equipped_title_item_id
          )
          .maybeSingle();

        if (titleError) {
          throw titleError;
        }

        setTitle(
          titleData as TitleItem | null
        );
      } else {
        setTitle(null);
      }

      // =========================
      // 上級關係
      // =========================

      const {
        data: superiorRelation,
        error: superiorRelationError,
      } = await supabase
        .from("hierarchy_relations")
        .select(`
          superior_id,
          subordinate_id,
          relation_type
        `)
        .eq(
          "subordinate_id",
          memberId
        )
        .eq("status", "active")
        .maybeSingle();

      if (
        superiorRelationError
      ) {
        throw superiorRelationError;
      }

      if (
        superiorRelation?.superior_id
      ) {
        const {
          data: superiorData,
          error: superiorError,
        } = await supabase
          .from("profiles")
          .select(`
            id,
            nickname,
            join_sequence
          `)
          .eq(
            "id",
            superiorRelation.superior_id
          )
          .single();

        if (superiorError) {
          throw superiorError;
        }

        setSuperior(
          superiorData as BasicProfile
        );
      } else {
        setSuperior(null);
      }

      // =========================
      // 直接附屬者
      // =========================

      const {
        data: subordinateRelations,
        error: subordinateRelationError,
      } = await supabase
        .from("hierarchy_relations")
        .select(`
          superior_id,
          subordinate_id,
          relation_type
        `)
        .eq(
          "superior_id",
          memberId
        )
        .eq("status", "active");

      if (
        subordinateRelationError
      ) {
        throw subordinateRelationError;
      }

      const subordinateIds =
        (
          subordinateRelations ??
          []
        ).map(
          (
            relation:
              Relation
          ) =>
            relation.subordinate_id
        );

      if (
        subordinateIds.length === 0
      ) {
        setSubordinates([]);
        return;
      }

      const {
        data: subordinateData,
        error: subordinateError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          nickname,
          join_sequence
        `)
        .in(
          "id",
          subordinateIds
        )
        .order(
          "join_sequence",
          {
            ascending: true,
          }
        );

      if (subordinateError) {
        throw subordinateError;
      }

      setSubordinates(
        (subordinateData ??
          []) as BasicProfile[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取成員資料時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const genderLabel =
    useMemo(() => {
      if (!member) {
        return "";
      }

      if (
        member.gender ===
        "female"
      ) {
        return "女性";
      }

      if (
        member.gender ===
        "male"
      ) {
        return "男性";
      }

      return "其他";
    }, [member]);

  function getRoleLabel(
    role: MemberProfile["role"]
  ) {
    if (
      role === "founder"
    ) {
      return "創始成員";
    }

    if (
      role ===
      "administrator"
    ) {
      return "系統管理者";
    }

    if (
      role === "manager"
    ) {
      return "管理成員";
    }

    return "一般成員";
  }

  function formatSequence(
    sequence: number
  ) {
    return String(
      sequence
    ).padStart(6, "0");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取成員資料…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-4xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              成員資料
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/members"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              世界成員
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
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {errorMessage}
          </div>
        )}

        {member && (
          <>
            <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  {title && (
                    <p className="mb-2 text-sm font-medium text-amber-300">
                      「{title.name}」
                    </p>
                  )}

                  <h2 className="text-3xl font-semibold">
                    {member.nickname}
                  </h2>

                  <p className="mt-3 text-neutral-500">
                    序號{" "}
                    {formatSequence(
                      member.join_sequence
                    )}
                  </p>
                </div>

                <div className="rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-400">
                  {getRoleLabel(
                    member.role
                  )}
                </div>
              </div>

              {title && (
                <div className="mt-5 rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
                  <p className="text-sm text-neutral-500">
                    已裝備稱號
                  </p>

                  <p className="mt-1 font-medium text-amber-300">
                    {title.name}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    {title.description}
                  </p>
                </div>
              )}

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-500">
                    性別
                  </p>

                  <p className="mt-2">
                    {genderLabel}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-500">
                    世界積分
                  </p>

                  <p className="mt-2 text-xl font-semibold">
                    {
                      member.world_points
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-500">
                    競技積分
                  </p>

                  <p className="mt-2 text-xl font-semibold">
                    {
                      member.arena_points
                    }
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-500">
                    連續打卡
                  </p>

                  <p className="mt-2 text-xl font-semibold">
                    {
                      member.checkin_streak
                    }{" "}
                    天
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <p className="text-sm text-neutral-500">
                  目前上級
                </p>

                {superior ? (
                  <Link
                    href={`/members/${superior.id}`}
                    className="mt-4 block rounded-xl bg-neutral-950 p-4 transition hover:bg-neutral-800"
                  >
                    <p className="text-lg font-medium">
                      {
                        superior.nickname
                      }
                    </p>

                    <p className="mt-1 text-sm text-neutral-500">
                      序號{" "}
                      {formatSequence(
                        superior.join_sequence
                      )}
                    </p>
                  </Link>
                ) : (
                  <div className="mt-4 rounded-xl bg-neutral-950 p-4 text-neutral-500">
                    目前沒有上級。
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
                <p className="text-sm text-neutral-500">
                  直接附屬者
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {
                    subordinates.length
                  }
                </p>

                <p className="mt-2 text-sm text-neutral-500">
                  人
                </p>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
              <p className="text-sm text-neutral-500">
                直接附屬者
              </p>

              {subordinates.length ===
              0 ? (
                <div className="mt-4 rounded-xl bg-neutral-950 p-5 text-neutral-400">
                  目前沒有直接附屬者。
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {subordinates.map(
                    (
                      subordinate
                    ) => (
                      <Link
                        key={
                          subordinate.id
                        }
                        href={`/members/${subordinate.id}`}
                        className="flex items-center justify-between gap-4 rounded-xl bg-neutral-950 p-4 transition hover:bg-neutral-800"
                      >
                        <div>
                          <p className="font-medium">
                            {
                              subordinate.nickname
                            }
                          </p>

                          <p className="mt-1 text-sm text-neutral-500">
                            序號{" "}
                            {formatSequence(
                              subordinate.join_sequence
                            )}
                          </p>
                        </div>

                        <span className="text-sm text-neutral-600">
                          查看
                        </span>
                      </Link>
                    )
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}