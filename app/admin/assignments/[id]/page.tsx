"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RelationDetail = {
  id: string;
  superior_id: string;
  subordinate_id: string;
  relation_type: string;
  status: string;
  assigned_by: string | null;
  created_at: string;
  ended_at: string | null;

  superior_name: string;
  subordinate_name: string;

  chat_room_id: string | null;
};

export default function AdminAssignmentDetailPage() {
  const router = useRouter();
  const params = useParams();

  const relationId = params.id as string;

  const [detail, setDetail] = useState<RelationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (relationId) {
      void loadDetail();
    }
  }, [relationId]);

  async function loadDetail() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // 確認管理者權限
      const { data: adminProfile, error: adminError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (adminError) {
        throw adminError;
      }

      if (
        adminProfile.status !== "active" ||
        !["founder", "administrator"].includes(adminProfile.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      // 讀取指定主從關係
      const { data: relation, error: relationError } = await supabase
        .from("hierarchy_relations")
        .select(`
          id,
          superior_id,
          subordinate_id,
          relation_type,
          status,
          assigned_by,
          created_at,
          ended_at
        `)
        .eq("id", relationId)
        .single();

      if (relationError) {
        throw relationError;
      }

      // 讀取雙方名稱
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", [
          relation.superior_id,
          relation.subordinate_id,
        ]);

      if (profilesError) {
        throw profilesError;
      }

      const superiorProfile = profiles?.find(
        (item) => item.id === relation.superior_id
      );

      const subordinateProfile = profiles?.find(
        (item) => item.id === relation.subordinate_id
      );

      // 尋找這一組主從的聊天室
      const { data: chatRooms, error: chatError } = await supabase
        .from("master_slave_chat_rooms")
        .select(`
          id,
          created_at
        `)
        .eq("master_id", relation.superior_id)
        .eq("slave_id", relation.subordinate_id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (chatError) {
        throw chatError;
      }

      setDetail({
        ...relation,

        superior_name:
          superiorProfile?.nickname ?? "未知玩家",

        subordinate_name:
          subordinateProfile?.nickname ?? "未知玩家",

        chat_room_id:
          chatRooms && chatRooms.length > 0
            ? chatRooms[0].id
            : null,
      });
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "無法讀取歸屬詳情"
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value: string | null) {
    if (!value) {
      return "—";
    }

    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  function getRelationType(type: string) {
    if (type === "system") {
      return "系統分配";
    }

    if (type === "voluntary") {
      return "自願歸屬";
    }

    return type;
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#080808",
          color: "#888",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        載入歸屬資料中...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#f5f5f5",
        padding: "48px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() => router.push("/admin/assignments")}
          style={{
            background: "transparent",
            color: "#999",
            border: "1px solid #333",
            borderRadius: 8,
            padding: "10px 14px",
            cursor: "pointer",
            marginBottom: 32,
          }}
        >
          ← 返回歸屬紀錄
        </button>

        <div
          style={{
            marginBottom: 32,
          }}
        >
          <div
            style={{
              color: "#ef4444",
              fontSize: 13,
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            ADMINISTRATION
          </div>

          <h1
            style={{
              fontSize: 32,
              margin: 0,
            }}
          >
            歸屬關係詳情
          </h1>
        </div>

        {error && (
          <div
            style={{
              border: "1px solid #7f1d1d",
              background: "#1f0a0a",
              color: "#f87171",
              borderRadius: 12,
              padding: 18,
            }}
          >
            {error}
          </div>
        )}

        {!error && detail && (
          <>
            <section
              style={{
                border: "1px solid #292929",
                background: "#111",
                borderRadius: 14,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 20,
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#777",
                      fontSize: 13,
                      marginBottom: 10,
                    }}
                  >
                    主從關係
                  </div>

                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                    }}
                  >
                    {detail.subordinate_name}

                    <span
                      style={{
                        color: "#555",
                        margin: "0 12px",
                      }}
                    >
                      →
                    </span>

                    {detail.superior_name}
                  </div>
                </div>

                <div
                  style={{
                    border:
                      detail.status === "active"
                        ? "1px solid #065f46"
                        : "1px solid #555",
                    color:
                      detail.status === "active"
                        ? "#34d399"
                        : "#999",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 13,
                  }}
                >
                  {detail.status === "active"
                    ? "有效"
                    : "已解除"}
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid #292929",
                  marginTop: 24,
                  paddingTop: 22,
                  display: "grid",
                  gap: 18,
                }}
              >
                <DetailRow
                  label="附屬者"
                  value={detail.subordinate_name}
                />

                <DetailRow
                  label="上級"
                  value={detail.superior_name}
                />

                <DetailRow
                  label="分配方式"
                  value={getRelationType(
                    detail.relation_type
                  )}
                />

                <DetailRow
                  label="關係狀態"
                  value={
                    detail.status === "active"
                      ? "有效"
                      : "已解除"
                  }
                />

                <DetailRow
                  label="建立時間"
                  value={formatDate(
                    detail.created_at
                  )}
                />

                <DetailRow
                  label="解除時間"
                  value={formatDate(
                    detail.ended_at
                  )}
                />
              </div>
            </section>

            <section
              style={{
                marginTop: 20,
                border: "1px solid #292929",
                background: "#111",
                borderRadius: 14,
                padding: 24,
              }}
            >
              <div
                style={{
                  color: "#777",
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                CHAT RECORD
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 20,
                }}
              >
                主從聊天室
              </h2>

              {detail.chat_room_id ? (
                <>
                  <p
                    style={{
                      color: "#888",
                      marginTop: 10,
                    }}
                  >
                    此關係具有對應的聊天室紀錄。
                  </p>

                  <button
                    onClick={() =>
                      router.push(
                        `/admin/chats/${detail.chat_room_id}`
                      )
                    }
                    style={{
                      marginTop: 8,
                      border: "1px solid #7f1d1d",
                      background: "#2a1010",
                      color: "#f87171",
                      borderRadius: 8,
                      padding: "10px 16px",
                      cursor: "pointer",
                    }}
                  >
                    查看聊天室紀錄 →
                  </button>
                </>
              ) : (
                <p
                  style={{
                    color: "#666",
                    marginTop: 10,
                  }}
                >
                  此關係沒有找到對應聊天室。
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr",
        gap: 20,
      }}
    >
      <div
        style={{
          color: "#666",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: "#ddd",
        }}
      >
        {value}
      </div>
    </div>
  );
}