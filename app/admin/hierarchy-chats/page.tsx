"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminHierarchyChatRoom = {
  room_id: string;
  superior_id: string;
  superior_nickname: string | null;
  member_count: number;
  last_message: string | null;
  last_message_at: string | null;
};

export default function AdminHierarchyChatsPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState<AdminHierarchyChatRoom[]>([]);
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

      const { data, error: rpcError } = await supabase.rpc(
        "admin_get_hierarchy_chat_rooms"
      );

      if (rpcError) {
        throw rpcError;
      }

      setRooms((data ?? []) as AdminHierarchyChatRoom[]);
    } catch (err) {
      console.error(err);
      setError("無法讀取階層聊天室。");
    } finally {
      setLoading(false);
    }
  }

  function formatTime(value: string | null) {
    if (!value) return "";

    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric",
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
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() => router.push("/admin")}
          style={{
            background: "transparent",
            border: "1px solid #333",
            color: "#aaa",
            borderRadius: 8,
            padding: "10px 14px",
            cursor: "pointer",
            marginBottom: 30,
          }}
        >
          ← 返回管理後台
        </button>

        <div
          style={{
            marginBottom: 32,
          }}
        >
          <div
            style={{
              color: "#8b5cf6",
              fontSize: 13,
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            HIERARCHY CHAT MONITOR
          </div>

          <h1
            style={{
              fontSize: 30,
              margin: 0,
              marginBottom: 10,
            }}
          >
            階層聊天室監督
          </h1>

          <div
            style={{
              color: "#777",
              lineHeight: 1.7,
            }}
          >
            管理員可唯讀查看所有階層聊天室及訊息紀錄。
          </div>
        </div>

        {loading && (
          <div
            style={{
              color: "#777",
            }}
          >
            載入階層聊天室中...
          </div>
        )}

        {error && (
          <div
            style={{
              border: "1px solid #7f1d1d",
              background: "#1f0a0a",
              color: "#f87171",
              borderRadius: 10,
              padding: 16,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && rooms.length === 0 && (
          <div
            style={{
              border: "1px solid #292929",
              background: "#111",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
              color: "#777",
            }}
          >
            目前沒有階層聊天室。
          </div>
        )}

        {!loading && !error && rooms.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {rooms.map((room) => (
              <button
                key={room.room_id}
                onClick={() =>
                  router.push(
                    `/admin/hierarchy-chats/${room.room_id}`
                  )
                }
                style={{
                  background: "#111",
                  border: "1px solid #292929",
                  borderRadius: 12,
                  padding: 20,
                  color: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 20,
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
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 7,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                        }}
                      >
                        {room.superior_nickname ?? "未知主人"}
                        的階層聊天室
                      </div>

                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "#2e1d46",
                          color: "#c4b5fd",
                          fontSize: 12,
                        }}
                      >
                        {room.member_count} 人
                      </span>
                    </div>

                    <div
                      style={{
                        color: room.last_message
                          ? "#aaa"
                          : "#666",
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {room.last_message ?? "目前還沒有訊息"}
                    </div>
                  </div>

                  <div
                    style={{
                      color: "#666",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatTime(room.last_message_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}