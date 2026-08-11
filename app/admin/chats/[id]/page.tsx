"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Room = {
  id: string;
  master_id: string;
  slave_id: string;
  master_name: string;
  slave_name: string;
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export default function AdminChatRoomPage() {
  const params = useParams();
  const router = useRouter();

  const roomId = params.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadChat();
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

      // 確認管理者
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

      // 讀聊天室
      const { data: roomData, error: roomError } = await supabase
        .from("master_slave_chat_rooms")
        .select("id, master_id, slave_id")
        .eq("id", roomId)
        .single();

      if (roomError) {
        throw roomError;
      }

      // 讀雙方名稱
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", [roomData.master_id, roomData.slave_id]);

      if (profilesError) {
        throw profilesError;
      }

      const masterProfile = profiles?.find(
        (profile) => profile.id === roomData.master_id
      );

      const slaveProfile = profiles?.find(
        (profile) => profile.id === roomData.slave_id
      );

      setRoom({
        id: roomData.id,
        master_id: roomData.master_id,
        slave_id: roomData.slave_id,
        master_name: masterProfile?.nickname ?? "未知主人",
        slave_name: slaveProfile?.nickname ?? "未知附屬者",
      });

      // 讀聊天訊息
      const { data: messageData, error: messageError } = await supabase
        .from("master_slave_chat_messages")
        .select("id, sender_id, content, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (messageError) {
        throw messageError;
      }

      setMessages(messageData ?? []);
    } catch (err) {
      console.error(err);
      setError("無法讀取聊天室");
    } finally {
      setLoading(false);
    }
  }

  function formatTime(value: string) {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  function getSenderName(senderId: string) {
    if (!room) return "未知玩家";

    if (senderId === room.master_id) {
      return room.master_name;
    }

    if (senderId === room.slave_id) {
      return room.slave_name;
    }

    return "未知玩家";
  }

  function getSenderRole(senderId: string) {
    if (!room) return "";

    if (senderId === room.master_id) {
      return "主人";
    }

    if (senderId === room.slave_id) {
      return "附屬者";
    }

    return "";
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
          onClick={() => router.push("/admin/chats")}
          style={{
            background: "transparent",
            border: "1px solid #333",
            color: "#aaa",
            padding: "10px 14px",
            borderRadius: 8,
            cursor: "pointer",
            marginBottom: 30,
          }}
        >
          ← 返回聊天室監督
        </button>

        {loading && (
          <div style={{ color: "#888" }}>
            載入聊天室中...
          </div>
        )}

        {error && (
          <div
            style={{
              color: "#f87171",
              border: "1px solid #7f1d1d",
              background: "#1f0a0a",
              borderRadius: 10,
              padding: 16,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && room && (
          <>
            <div style={{ marginBottom: 30 }}>
              <div
                style={{
                  color: "#ef4444",
                  fontSize: 13,
                  letterSpacing: 2,
                  marginBottom: 10,
                }}
              >
                ADMIN CHAT MONITOR
              </div>

              <h1
                style={{
                  fontSize: 28,
                  margin: 0,
                  marginBottom: 10,
                }}
              >
                {room.master_name}
                <span
                  style={{
                    color: "#555",
                    margin: "0 12px",
                  }}
                >
                  ↔
                </span>
                {room.slave_name}
              </h1>

              <div style={{ color: "#777" }}>
                管理者監督模式，只能查看，不能發言。
              </div>
            </div>

            <div
              style={{
                border: "1px solid #292929",
                borderRadius: 12,
                background: "#101010",
                minHeight: 500,
                padding: 20,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    color: "#666",
                    textAlign: "center",
                    padding: "80px 20px",
                  }}
                >
                  目前還沒有聊天訊息。
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      borderBottom: "1px solid #222",
                      paddingBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        marginBottom: 7,
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontWeight: 700,
                          }}
                        >
                          {getSenderName(message.sender_id)}
                        </span>

                        <span
                          style={{
                            marginLeft: 8,
                            color: "#777",
                            fontSize: 12,
                          }}
                        >
                          {getSenderRole(message.sender_id)}
                        </span>
                      </div>

                      <div
                        style={{
                          color: "#666",
                          fontSize: 12,
                        }}
                      >
                        {formatTime(message.created_at)}
                      </div>
                    </div>

                    <div
                      style={{
                        color: "#ddd",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}