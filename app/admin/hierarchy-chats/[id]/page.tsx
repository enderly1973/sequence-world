"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RoomInfo = {
  room_id: string;
  superior_id: string;
  superior_nickname: string | null;
  member_count: number;
  last_message: string | null;
  last_message_at: string | null;
};

type ChatMessage = {
  message_id: string;
  sender_id: string;
  sender_nickname: string | null;
  content: string;
  created_at: string;
  is_superior: boolean;
};

export default function AdminHierarchyChatDetailPage() {
  const params = useParams();
  const router = useRouter();

  const roomId = params.id as string;

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roomId) return;

    void loadChat();
  }, [roomId]);

  async function loadChat() {
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

      const {
        data: roomData,
        error: roomError,
      } = await supabase.rpc(
        "admin_get_hierarchy_chat_rooms"
      );

      if (roomError) {
        throw roomError;
      }

      const roomList =
        (roomData ?? []) as RoomInfo[];

      const currentRoom =
        roomList.find(
          (item) => item.room_id === roomId
        ) ?? null;

      if (!currentRoom) {
        setError(
          "找不到此階層聊天室，或你沒有管理權限。"
        );
        return;
      }

      setRoom(currentRoom);

      const {
        data: messageData,
        error: messageError,
      } = await supabase.rpc(
        "admin_get_hierarchy_chat_messages",
        {
          p_room_id: roomId,
        }
      );

      if (messageError) {
        throw messageError;
      }

      setMessages(
        (messageData ?? []) as ChatMessage[]
      );
    } catch (err) {
      console.error(err);

      setError("無法讀取階層聊天室內容。");
    } finally {
      setLoading(false);
    }
  }

  function formatTime(value: string) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }
    ).format(new Date(value));
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#080808",
          color: "#777",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          載入聊天室紀錄中...
        </div>
      </main>
    );
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
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() =>
            router.push(
              "/admin/hierarchy-chats"
            )
          }
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
          ← 返回階層聊天室監督
        </button>

        {error && !room && (
          <div
            style={{
              border:
                "1px solid #7f1d1d",
              background: "#1f0a0a",
              color: "#f87171",
              borderRadius: 10,
              padding: 16,
            }}
          >
            {error}
          </div>
        )}

        {room && (
          <>
            <header
              style={{
                borderBottom:
                  "1px solid #292929",
                paddingBottom: 24,
                marginBottom: 26,
              }}
            >
              <div
                style={{
                  color: "#8b5cf6",
                  fontSize: 12,
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                ADMIN READ ONLY
              </div>

              <h1
                style={{
                  fontSize: 28,
                  margin: 0,
                  marginBottom: 10,
                }}
              >
                {room.superior_nickname ??
                  "未知主人"}{" "}
                的階層聊天室
              </h1>

              <div
                style={{
                  color: "#777",
                  fontSize: 14,
                  lineHeight: 1.7,
                }}
              >
                <div>
                  聊天室成員：
                  {room.member_count} 人
                </div>

                <div>
                  模式：管理員唯讀監督
                </div>
              </div>
            </header>

            <section
              style={{
                border:
                  "1px solid #3b2754",
                background: "#130f1a",
                color: "#b9a9cc",
                borderRadius: 10,
                padding: 14,
                marginBottom: 24,
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              管理員僅能查看此聊天室紀錄，
              不會加入聊天室成員，也無法在此發送訊息。
            </section>

            {error && (
              <div
                style={{
                  border:
                    "1px solid #7f1d1d",
                  background: "#1f0a0a",
                  color: "#f87171",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 20,
                }}
              >
                {error}
              </div>
            )}

            <section
              style={{
                minHeight: 420,
                border:
                  "1px solid #292929",
                background: "#0d0d0d",
                borderRadius: 14,
                padding: 20,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    color: "#666",
                    textAlign: "center",
                    paddingTop: 100,
                  }}
                >
                  此聊天室目前沒有訊息。
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                {messages.map(
                  (message) => (
                    <div
                      key={
                        message.message_id
                      }
                      style={{
                        borderBottom:
                          "1px solid #202020",
                        paddingBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 7,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              message.is_superior
                                ? "#c4b5fd"
                                : "#ddd",
                          }}
                        >
                          {message.sender_nickname ??
                            "未知玩家"}
                        </span>

                        {message.is_superior && (
                          <span
                            style={{
                              borderRadius: 999,
                              padding:
                                "2px 7px",
                              background:
                                "#2e1d46",
                              color:
                                "#c4b5fd",
                              fontSize: 11,
                            }}
                          >
                            主人
                          </span>
                        )}

                        <span
                          style={{
                            color: "#555",
                            fontSize: 12,
                          }}
                        >
                          {formatTime(
                            message.created_at
                          )}
                        </span>
                      </div>

                      <div
                        style={{
                          color: "#ddd",
                          lineHeight: 1.7,
                          whiteSpace:
                            "pre-wrap",
                          wordBreak:
                            "break-word",
                        }}
                      >
                        {message.content}
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}