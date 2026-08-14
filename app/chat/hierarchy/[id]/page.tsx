"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Room = {
  id: string;
  superior_id: string;
  created_at: string;
};

type Member = {
  id: string;
  nickname: string;
  isSuperior: boolean;
};

type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_name: string;
};

export default function HierarchyChatPage() {
  const params = useParams();
  const router = useRouter();

  const roomId = params.id as string;

  const [currentUserId, setCurrentUserId] =
    useState<string>("");

  const [room, setRoom] = useState<Room | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [messageText, setMessageText] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!roomId) return;

    void loadChat();
  }, [roomId]);

  useEffect(() => {
  if (!roomId) return;

  const channel = supabase
    .channel(`hierarchy-chat-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "hierarchy_chat_messages",
        filter: `room_id=eq.${roomId}`,
      },
      async (payload) => {
        const newRow = payload.new as {
          id: string;
          room_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };

        setMessages((current) => {
          if (
            current.some(
              (message) => message.id === newRow.id
            )
          ) {
            return current;
          }

          const sender =
            members.find(
              (member) =>
                member.id === newRow.sender_id
            ) ?? null;

          return [
            ...current,
            {
              ...newRow,
              sender_name:
                sender?.nickname ?? "未知玩家",
            },
          ];
        });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, [roomId, members]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

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

      setCurrentUserId(user.id);

      const { error: readUpsertError } = await supabase
  .from("hierarchy_chat_reads")
  .upsert(
    {
      room_id: roomId,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    {
      onConflict: "room_id,user_id",
    }
  );

if (readUpsertError) {
  console.error(readUpsertError);
}

      const { data: roomData, error: roomError } =
        await supabase
          .from("hierarchy_chat_rooms")
          .select("id, superior_id, created_at")
          .eq("id", roomId)
          .maybeSingle();

      if (roomError) {
        throw roomError;
      }

      if (!roomData) {
        setError(
          "找不到此階層聊天室，或你沒有進入權限。"
        );
        return;
      }

      setRoom(roomData);

      const {
        data: memberData,
        error: memberError,
      } = await supabase
        .from("hierarchy_chat_members")
        .select("user_id")
        .eq("room_id", roomId);

      if (memberError) {
        throw memberError;
      }

      const memberIds = [
        ...new Set(
          (memberData ?? []).map(
            (item) => item.user_id
          )
        ),
      ];

      let nameMap = new Map<string, string>();

      if (memberIds.length > 0) {
        const {
          data: profileData,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", memberIds);

        if (profileError) {
          throw profileError;
        }

        nameMap = new Map(
          (profileData ?? []).map((profile) => [
            profile.id,
            profile.nickname ?? "未命名玩家",
          ])
        );
      }

      const memberList: Member[] = memberIds.map(
        (id) => ({
          id,
          nickname:
            nameMap.get(id) ?? "未知玩家",
          isSuperior:
            id === roomData.superior_id,
        })
      );

      memberList.sort((a, b) => {
        if (a.isSuperior && !b.isSuperior) {
          return -1;
        }

        if (!a.isSuperior && b.isSuperior) {
          return 1;
        }

        return a.nickname.localeCompare(
          b.nickname,
          "zh-TW"
        );
      });

      setMembers(memberList);

      const {
        data: messageData,
        error: messageError,
      } = await supabase
        .from("hierarchy_chat_messages")
        .select(
          "id, room_id, sender_id, content, created_at"
        )
        .eq("room_id", roomId)
        .order("created_at", {
          ascending: true,
        });

      if (messageError) {
        throw messageError;
      }

      const messageSenderIds = [
        ...new Set(
          (messageData ?? []).map(
            (item) => item.sender_id
          )
        ),
      ];

      const missingIds =
        messageSenderIds.filter(
          (id) => !nameMap.has(id)
        );

      if (missingIds.length > 0) {
        const {
          data: extraProfiles,
          error: extraProfileError,
        } = await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", missingIds);

        if (extraProfileError) {
          throw extraProfileError;
        }

        for (const profile of extraProfiles ?? []) {
          nameMap.set(
            profile.id,
            profile.nickname ?? "未命名玩家"
          );
        }
      }

      const messageList: Message[] =
        (messageData ?? []).map((message) => ({
          ...message,
          sender_name:
            nameMap.get(message.sender_id) ??
            "未知玩家",
        }));

      setMessages(messageList);
    } catch (err) {
      console.error(err);

      setError("無法讀取階層聊天室。");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanMessage = messageText.trim();

    if (!cleanMessage || !currentUserId) {
      return;
    }

    try {
      setSending(true);
      setError("");
      setSuccessMessage("");

      const {
        data: insertedMessage,
        error: sendError,
      } = await supabase
        .from("hierarchy_chat_messages")
        .insert({
          room_id: roomId,
          sender_id: currentUserId,
          content: cleanMessage,
        })
        .select(
          "id, room_id, sender_id, content, created_at"
        )
        .single();

      if (sendError) {
        throw sendError;
      }

      const sender =
        members.find(
          (member) =>
            member.id === currentUserId
        ) ?? null;

      const newMessage: Message = {
        ...insertedMessage,
        sender_name:
          sender?.nickname ?? "未知玩家",
      };

      setMessages((current) => [
        ...current,
        newMessage,
      ]);

      setMessageText("");
    } catch (err) {
      console.error(err);

      setError("訊息發送失敗。");
    } finally {
      setSending(false);
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

  const superior =
    members.find(
      (member) => member.isSuperior
    ) ?? null;

  const isSuperior =
    room?.superior_id === currentUserId;

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
          載入階層聊天室中...
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
        padding: "32px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() => router.push("/chat")}
          style={{
            background: "transparent",
            border: "1px solid #333",
            color: "#aaa",
            borderRadius: 8,
            padding: "10px 14px",
            cursor: "pointer",
            marginBottom: 26,
          }}
        >
          ← 返回通訊中心
        </button>

        {error && !room && (
          <div
            style={{
              border: "1px solid #7f1d1d",
              background: "#1f0a0a",
              color: "#f87171",
              borderRadius: 12,
              padding: 20,
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
                marginBottom: 24,
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
                HIERARCHY CHAT
              </div>

              <h1
                style={{
                  fontSize: 28,
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                {isSuperior
                  ? "我的階層聊天室"
                  : `${superior?.nickname ?? "上級"} 的階層聊天室`}
              </h1>

              <div
                style={{
                  color: "#777",
                  fontSize: 14,
                }}
              >
                {members.length} 位成員
              </div>
            </header>

            <section
              style={{
                border: "1px solid #292929",
                background: "#101010",
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  color: "#888",
                  fontSize: 12,
                  letterSpacing: 1.5,
                  marginBottom: 12,
                }}
              >
                MEMBERS
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {members.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      border: member.isSuperior
                        ? "1px solid #5b3a7a"
                        : "1px solid #333",
                      background: member.isSuperior
                        ? "#1a1024"
                        : "#161616",
                      borderRadius: 999,
                      padding: "7px 11px",
                      fontSize: 13,
                      color: member.isSuperior
                        ? "#c4b5fd"
                        : "#bbb",
                    }}
                  >
                    {member.nickname}
                    {member.isSuperior
                      ? " · 主人"
                      : ""}
                  </div>
                ))}
              </div>
            </section>

            <section
              style={{
                minHeight: 420,
                border: "1px solid #292929",
                background: "#0d0d0d",
                borderRadius: 14,
                padding: 20,
                marginBottom: 16,
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
                  目前還沒有訊息。
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {messages.map((message) => {
                  const isMine =
                    message.sender_id ===
                    currentUserId;

                  const senderIsSuperior =
                    message.sender_id ===
                    room.superior_id;

                  return (
                    <div
                      key={message.id}
                      style={{
                        display: "flex",
                        flexDirection:
                          isMine
                            ? "row-reverse"
                            : "row",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "75%",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent:
                              isMine
                                ? "flex-end"
                                : "flex-start",
                            gap: 7,
                            alignItems: "center",
                            marginBottom: 5,
                            fontSize: 12,
                          }}
                        >
                          <span
                            style={{
                              color:
                                senderIsSuperior
                                  ? "#a78bfa"
                                  : "#888",
                            }}
                          >
                            {message.sender_name}
                            {senderIsSuperior
                              ? " · 主人"
                              : ""}
                          </span>

                          <span
                            style={{
                              color: "#555",
                            }}
                          >
                            {formatTime(
                              message.created_at
                            )}
                          </span>
                        </div>

                        <div
                          style={{
                            background: isMine
                              ? "#2e1d46"
                              : "#1b1b1b",
                            border: isMine
                              ? "1px solid #493064"
                              : "1px solid #303030",
                            borderRadius: 12,
                            padding:
                              "11px 14px",
                            color: "#eee",
                            lineHeight: 1.6,
                            whiteSpace:
                              "pre-wrap",
                            wordBreak:
                              "break-word",
                          }}
                        >
                          {message.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div ref={bottomRef} />
            </section>

            {error && (
              <div
                style={{
                  border:
                    "1px solid #7f1d1d",
                  background: "#1f0a0a",
                  color: "#f87171",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 12,
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            {successMessage && (
              <div
                style={{
                  color: "#86efac",
                  marginBottom: 12,
                }}
              >
                {successMessage}
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              style={{
                display: "flex",
                gap: 10,
              }}
            >
              <textarea
                value={messageText}
                onChange={(event) =>
                  setMessageText(
                    event.target.value
                  )
                }
                placeholder="輸入訊息..."
                rows={2}
                maxLength={2000}
                style={{
                  flex: 1,
                  resize: "none",
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: 10,
                  padding: "12px 14px",
                  color: "#fff",
                  outline: "none",
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              />

              <button
                type="submit"
                disabled={
                  sending ||
                  !messageText.trim()
                }
                style={{
                  alignSelf: "stretch",
                  minWidth: 86,
                  border: 0,
                  borderRadius: 10,
                  padding: "0 18px",
                  background:
                    sending ||
                    !messageText.trim()
                      ? "#292929"
                      : "#7c3aed",
                  color:
                    sending ||
                    !messageText.trim()
                      ? "#666"
                      : "#fff",
                  cursor:
                    sending ||
                    !messageText.trim()
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 700,
                }}
              >
                {sending
                  ? "傳送中"
                  : "傳送"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}