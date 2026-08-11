"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RelationRow = {
  id: string;
  superior_id: string;
  subordinate_id: string;
  relation_type: string;
  status: string;
  assigned_by: string | null;
  created_at: string;
  ended_at: string | null;
};

type AssignmentRecord = RelationRow & {
  superior_name: string;
  subordinate_name: string;
};

type FilterType =
  | "all"
  | "active"
  | "ended"
  | "system";

export default function AdminAssignmentsPage() {
  const router = useRouter();

  const [records, setRecords] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    void loadRecords();
  }, []);

  async function loadRecords() {
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

      const { data: relationData, error: relationError } = await supabase
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
        .order("created_at", {
          ascending: false,
        });

      if (relationError) {
        throw relationError;
      }

      if (!relationData || relationData.length === 0) {
        setRecords([]);
        return;
      }

      const ids = [
        ...new Set(
          relationData.flatMap((item) => [
            item.superior_id,
            item.subordinate_id,
          ])
        ),
      ];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", ids);

      if (profilesError) {
        throw profilesError;
      }

      const nameMap = new Map(
        (profiles ?? []).map((item) => [
          item.id,
          item.nickname ?? "未命名玩家",
        ])
      );

      const result: AssignmentRecord[] = relationData.map((item) => ({
        ...item,
        superior_name:
          nameMap.get(item.superior_id) ?? "未知玩家",
        subordinate_name:
          nameMap.get(item.subordinate_id) ?? "未知玩家",
      }));

      setRecords(result);
    } catch (err) {
      console.error(err);
      setError("無法讀取歸屬紀錄");
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

  const filteredRecords = records.filter((record) => {
    if (filter === "active") {
      return record.status === "active";
    }

    if (filter === "ended") {
      return record.status === "ended";
    }

    if (filter === "system") {
      return record.relation_type === "system";
    }

    return true;
  });

  const filters: Array<{
    value: FilterType;
    label: string;
  }> = [
    {
      value: "all",
      label: "全部",
    },
    {
      value: "active",
      label: "有效",
    },
    {
      value: "ended",
      label: "已解除",
    },
    {
      value: "system",
      label: "系統分配",
    },
  ];

  const totalCount = records.length;

  const activeCount = records.filter(
    (record) => record.status === "active"
  ).length;

  const endedCount = records.filter(
    (record) => record.status === "ended"
  ).length;

  const systemCount = records.filter(
    (record) => record.relation_type === "system"
  ).length;

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
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() => router.push("/admin")}
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

        <div style={{ marginBottom: 32 }}>
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
            歸屬分配紀錄
          </h1>

          <p
            style={{
              margin: 0,
              color: "#888",
            }}
          >
            查看世界中的主從關係建立與解除紀錄。
          </p>
        </div>

        {!loading && !error && records.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                border: "1px solid #292929",
                background: "#111",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ color: "#777", fontSize: 13 }}>
                全部紀錄
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {totalCount}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #064e3b",
                background: "#071711",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ color: "#6ee7b7", fontSize: 13 }}>
                目前有效
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#34d399",
                }}
              >
                {activeCount}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #3f3f46",
                background: "#111",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ color: "#a1a1aa", fontSize: 13 }}>
                已解除
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {endedCount}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #4c1d95",
                background: "#120a1f",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ color: "#c4b5fd", fontSize: 13 }}>
                系統分配
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#c4b5fd",
                }}
              >
                {systemCount}
              </div>
            </div>
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            {filters.map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                style={{
                  border:
                    filter === item.value
                      ? "1px solid #ef4444"
                      : "1px solid #333",
                  background:
                    filter === item.value
                      ? "#2a1010"
                      : "#111",
                  color:
                    filter === item.value
                      ? "#f87171"
                      : "#aaa",
                  borderRadius: 8,
                  padding: "9px 14px",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ color: "#777" }}>
            載入紀錄中...
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

        {!loading && !error && records.length === 0 && (
          <div
            style={{
              padding: 30,
              border: "1px solid #292929",
              background: "#111",
              borderRadius: 12,
              color: "#777",
              textAlign: "center",
            }}
          >
            目前沒有歸屬紀錄。
          </div>
        )}

        {!loading &&
          !error &&
          records.length > 0 &&
          filteredRecords.length === 0 && (
            <div
              style={{
                padding: 30,
                border: "1px solid #292929",
                background: "#111",
                borderRadius: 12,
                color: "#777",
                textAlign: "center",
              }}
            >
              此篩選條件目前沒有紀錄。
            </div>
          )}

        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              style={{
                background: "#111",
                border: "1px solid #292929",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {record.subordinate_name}

                    <span
                      style={{
                        color: "#666",
                        margin: "0 10px",
                      }}
                    >
                      →
                    </span>

                    {record.superior_name}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      color: "#888",
                      fontSize: 14,
                    }}
                  >
                    {getRelationType(record.relation_type)}
                  </div>
                </div>

                <div
                  style={{
                    border:
                      record.status === "active"
                        ? "1px solid #065f46"
                        : "1px solid #555",
                    color:
                      record.status === "active"
                        ? "#34d399"
                        : "#999",
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontSize: 12,
                  }}
                >
                  {record.status === "active"
                    ? "有效"
                    : "已解除"}
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid #292929",
                  marginTop: 18,
                  paddingTop: 15,
                  display: "grid",
                  gap: 7,
                  color: "#777",
                  fontSize: 13,
                }}
              >
                <div>
                  建立時間：
                  {formatDate(record.created_at)}
                </div>

                <div>
                  解除時間：
                  {formatDate(record.ended_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}