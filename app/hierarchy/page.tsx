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

type RelationRow = {
  id: string;
  superior_id: string | null;
  subordinate_id: string;
  relation_type:
    | "automatic"
    | "voluntary"
    | "admin_assigned"
    | "system";
  status: "active" | "pending" | "ended" | "suspended";
  created_at: string;
};

type SuperiorInfo = {
  relationId: string;
  profile: ProfileSummary;
  relationType: RelationRow["relation_type"];
  createdAt: string;
} | null;

type SubordinateInfo = {
  relationId: string;
  profile: ProfileSummary;
  relationType: RelationRow["relation_type"];
  createdAt: string;
};

export default function HierarchyPage() {
  const router = useRouter();

  const [currentProfile, setCurrentProfile] =
    useState<ProfileSummary | null>(null);

  const [superior, setSuperior] =
    useState<SuperiorInfo>(null);

  const [subordinates, setSubordinates] =
    useState<SubordinateInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadHierarchy();
  }, []);

  async function loadHierarchy() {
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

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, nickname, gender, join_sequence")
          .eq("id", user.id)
          .single();

      if (profileError) {
        throw profileError;
      }

      setCurrentProfile(profileData as ProfileSummary);

      const {
        data: superiorRelation,
        error: superiorRelationError,
      } = await supabase
        .from("hierarchy_relations")
        .select(
          `
            id,
            superior_id,
            subordinate_id,
            relation_type,
            status,
            created_at
          `
        )
        .eq("subordinate_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (superiorRelationError) {
        throw superiorRelationError;
      }

      if (superiorRelation?.superior_id) {
        const {
          data: superiorProfile,
          error: superiorProfileError,
        } = await supabase
          .from("profiles")
          .select("id, nickname, gender, join_sequence")
          .eq("id", superiorRelation.superior_id)
          .single();

        if (superiorProfileError) {
          throw superiorProfileError;
        }

        setSuperior({
          relationId: superiorRelation.id,
          profile: superiorProfile as ProfileSummary,
          relationType: superiorRelation.relation_type,
          createdAt: superiorRelation.created_at,
        });
      } else {
        setSuperior(null);
      }

      const {
        data: subordinateRelations,
        error: subordinateRelationsError,
      } = await supabase
        .from("hierarchy_relations")
        .select(
          `
            id,
            superior_id,
            subordinate_id,
            relation_type,
            status,
            created_at
          `
        )
        .eq("superior_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (subordinateRelationsError) {
        throw subordinateRelationsError;
      }

      const relationRows =
        (subordinateRelations ?? []) as RelationRow[];

      if (relationRows.length === 0) {
        setSubordinates([]);
        return;
      }

      const subordinateIds = relationRows.map(
        (relation) => relation.subordinate_id
      );

      const {
        data: subordinateProfiles,
        error: subordinateProfilesError,
      } = await supabase
        .from("profiles")
        .select("id, nickname, gender, join_sequence")
        .in("id", subordinateIds);

      if (subordinateProfilesError) {
        throw subordinateProfilesError;
      }

      const profileMap = new Map(
        (subordinateProfiles as ProfileSummary[]).map(
          (profile) => [profile.id, profile]
        )
      );

      const combinedData = relationRows
        .map((relation) => {
          const profile = profileMap.get(
            relation.subordinate_id
          );

          if (!profile) {
            return null;
          }

          return {
            relationId: relation.id,
            profile,
            relationType: relation.relation_type,
            createdAt: relation.created_at,
          };
        })
        .filter(
          (
            item
          ): item is SubordinateInfo => item !== null
        )
        .sort(
          (a, b) =>
            a.profile.join_sequence -
            b.profile.join_sequence
        );

      setSubordinates(combinedData);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "讀取階級關係時發生錯誤。";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLeaveSuperior() {
    if (!superior || leaving) {
      return;
    }

    const confirmed = window.confirm(
      `確定要解除對「${superior.profile.nickname}」的歸屬關係嗎？\n\n解除後，雙方將無法繼續使用此主從聊天室。`
    );

    if (!confirmed) {
      return;
    }

    setLeaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.rpc(
        "leave_my_superior"
      );

      if (error) {
        throw error;
      }

      const superiorName = superior.profile.nickname;

      setSuperior(null);
      setSuccessMessage(
        `已解除對「${superiorName}」的歸屬關係。`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "解除歸屬關係時發生錯誤。"
      );
    } finally {
      setLeaving(false);
    }
  }

  function formatSequence(sequence: number) {
    return String(sequence).padStart(6, "0");
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(dateString));
  }

  function getGenderLabel(
    gender: ProfileSummary["gender"]
  ) {
    if (gender === "female") return "女性";
    if (gender === "male") return "男性";
    return "其他";
  }

  function getRelationLabel(
    relationType: RelationRow["relation_type"]
  ) {
    if (relationType === "automatic") {
      return "系統分配";
    }

    if (relationType === "voluntary") {
      return "自願歸屬";
    }

    if (relationType === "admin_assigned") {
      return "管理員指派";
    }

    return "系統歸屬";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取階級關係…
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
              階級關係
            </h1>

            {currentProfile && (
              <p className="mt-3 text-neutral-400">
                {currentProfile.nickname}・序號{" "}
                {formatSequence(
                  currentProfile.join_sequence
                )}
              </p>
            )}
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

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-emerald-300">
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-500">
            我的上級
          </p>

          {superior ? (
            <div className="mt-5 rounded-xl bg-neutral-950 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-medium">
                    {superior.profile.nickname}
                  </p>

                  <p className="mt-2 text-sm text-neutral-500">
                    序號{" "}
                    {formatSequence(
                      superior.profile.join_sequence
                    )}
                    ・
                    {getGenderLabel(
                      superior.profile.gender
                    )}
                  </p>
                </div>

                <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                  {getRelationLabel(
                    superior.relationType
                  )}
                </span>
              </div>

              <p className="mt-4 text-sm text-neutral-500">
                關係建立日期：
                {formatDate(superior.createdAt)}
              </p>

              <div className="mt-5 border-t border-neutral-800 pt-4">
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => void handleLeaveSuperior()}
                  className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 transition hover:border-red-700 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {leaving ? "解除中…" : "解除歸屬"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有上級。
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-neutral-500">
              我的直接從屬者
            </p>

            <span className="text-sm text-neutral-400">
              共 {subordinates.length} 人
            </span>
          </div>

          {subordinates.length === 0 ? (
            <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前沒有直接從屬者。
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {subordinates.map((item) => (
                <article
                  key={item.relationId}
                  className="rounded-xl bg-neutral-950 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-medium">
                        {item.profile.nickname}
                      </p>

                      <p className="mt-2 text-sm text-neutral-500">
                        序號{" "}
                        {formatSequence(
                          item.profile.join_sequence
                        )}
                        ・
                        {getGenderLabel(
                          item.profile.gender
                        )}
                      </p>
                    </div>

                    <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300">
                      {getRelationLabel(
                        item.relationType
                      )}
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-neutral-500">
                    關係建立日期：
                    {formatDate(item.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}