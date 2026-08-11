"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ChatRoom = {
  id: string;
  master_id: string;
  slave_id: string;
  created_at: string;
  master_name: string;
  slave_name: string;
  last_message: string | null;
  last_message_at: string | null;
  is_active: boolean;
};

export default function AdminChatsPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadRooms();
  }, []);

  async function loadRooms() {
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

      // 確認管理者身分
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (
        profile.status !== "active" ||
        !["founder", "administrator"].includes(profile.role)
      ) {
        router.replace("/dashboard");
        return;
      }

      // 讀取所有聊天室
      const { data: roomData, error: roomError } = await supabase
        .from("master_slave_chat_rooms")
        .select("*")
        .order("created_at", { ascending: false });

      if (roomError) {
        throw roomError;
      }

      if (!roomData || roomData.length === 0) {
        setRooms([]);
        return;
      }

      const userIds = [
        ...new Set(
          roomData.flatMap((room) => [
            room.master_id,
            room.slave_id,
          ])
        ),
      ];

      // 取得玩家名稱
      const { data: profiles, error: profilesError } =
        await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", userIds);

      if (profilesError) {
        throw profilesError;
      }

      const nameMap = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.nickname ?? "未命名玩家",
        ])
      );

      // 讀取目前有效主從關係
      const { data: activeRelations, error: relationError } =
        await supabase
          .from("hierarchy_relations")
          .select("superior_id, subordinate_id")
          .eq("status", "active");

      if (relationError) {
        throw relationError;
      }

      const activeRelationSet = new Set(
        (activeRelations ?? []).map(
          (relation) =>
            `${relation.superior_id}:${relation.subordinate_id}`
        )
      );

      // 每個聊天室抓最後一則訊息
      const result: ChatRoom[] = await Promise.all(
        roomData.map(async (room) => {
          const { data: lastMessage } = await supabase
            .from("master_slave_chat_messages")
            .select("content, created_at")
            .eq("room_id", room.id)
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

          const relationKey =
            `${room.master_id}:${room.slave_id}`;

          return {
            id: room.id,
            master_id: room.master_id,
            slave_id: room.slave_id,
            created_at: room.created_at,
            master_name:
              nameMap.get(room.master_id) ??
              "未知主人",
            slave_name:
              nameMap.get(room.slave_id) ??
              "未知附屬者",
            last_message:
              lastMessage?.content ?? null,
            last_message_at:
              lastMessage?.created_at ?? null,
            is_active:
              activeRelationSet.has(relationKey),
          };
        })
      );

      result.sort((a, b) => {
        const aTime = new Date(
          a.last_message_at ?? a.created_at
        ).getTime();

        const bTime = new Date(
          b.last_message_at ?? b.created_at
        ).getTime();

        return bTime - aTime;
      });

      setRooms(result);
    } catch (err) {
      console.error(err);
      setError("無法讀取聊天室資料");
    } finally {
      setLoading(false);
    }
  }

  function formatTime(value: string | null) {
    if (!value) return "";

    return new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
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
          width: "100%",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() =>
            router.push("/admin")
          }
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
          ← 返回管理後台
        </button>

        <div
          style={{
            marginBottom: 36,
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
              marginBottom: 10,
            }}
          >
            主奴聊天室監督
          </h1>

          <p
            style={{
              color: "#888",
              margin: 0,
            }}
          >
            管理者可查看世界中所有主奴聊天室與歷史對話紀錄。
          </p>
        </div>

        {loading && (
          <div
            style={{
              color: "#888",
            }}
          >
            載入聊天室中...
          </div>
        )}

        {error && (
          <div
            style={{
              border:
                "1px solid #7f1d1d",
              background: "#1f0a0a",
              padding: 16,
              borderRadius: 10,
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          rooms.length === 0 && (
            <div
              style={{
                border:
                  "1px solid #292929",
                background: "#111",
                borderRadius: 12,
                padding: 32,
                color: "#888",
                textAlign: "center",
              }}
            >
              目前還沒有主奴聊天室。
            </div>
          )}

        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() =>
                router.push(
                  `/admin/chats/${room.id}`
                )
              }
              style={{
                width: "100%",
                textAlign: "left",
                background: room.is_active
                  ? "#111"
                  : "#0d0d0d",
                border: room.is_active
                  ? "1px solid #292929"
                  : "1px solid #3f3f46",
                borderRadius: 12,
                padding: 20,
                color: "#fff",
                cursor: "pointer",
                opacity: room.is_active
                  ? 1
                  : 0.72,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 20,
                  alignItems:
                    "flex-start",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      flexWrap: "wrap",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {room.master_name}

                      <span
                        style={{
                          color:
                            "#666",
                          margin:
                            "0 10px",
                        }}
                      >
                        ↔
                      </span>

                      {room.slave_name}
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        padding:
                          "4px 9px",
                        borderRadius:
                          999,
                        border:
                          room.is_active
                            ? "1px solid #065f46"
                            : "1px solid #52525b",
                        color:
                          room.is_active
                            ? "#6ee7b7"
                            : "#a1a1aa",
                        background:
                          room.is_active
                            ? "#022c22"
                            : "#18181b",
                      }}
                    >
                      {room.is_active
                        ? "現役"
                        : "已解除"}
                    </span>
                  </div>

                  <div
                    style={{
                      color:
                        room.last_message
                          ? "#aaa"
                          : "#666",
                      fontSize: 14,
                      maxWidth: 750,
                      overflow:
                        "hidden",
                      textOverflow:
                        "ellipsis",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    {room.last_message ??
                      "尚未有任何訊息"}
                  </div>
                </div>

                <div
                  style={{
                    color: "#666",
                    fontSize: 13,
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  {formatTime(
                    room.last_message_at ??
                      room.created_at
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}