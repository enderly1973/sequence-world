"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type HierarchyRow = {
  player_id: string;
  nickname: string;
  gender: "female" | "male" | "other";
  join_sequence: number;
  superior_id: string | null;
  superior_nickname: string | null;
  relation_type: string | null;
  equipped_title_item_id: string | null;
};

type TitleItem = {
  id: string;
  name: string;
};

type TreeNode = HierarchyRow & {
  children: TreeNode[];
};

export default function WorldTreePage() {
  const router = useRouter();

  const [rows, setRows] =
    useState<HierarchyRow[]>([]);

  const [titles, setTitles] =
    useState<TitleItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    void loadWorldTree();
  }, []);

  async function loadWorldTree() {
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

      // 每日任務：查看世界階級圖
      const {
        error: missionError,
      } = await supabase.rpc(
        "complete_daily_mission",
        {
          p_mission_key:
            "view_world_tree",
        }
      );

      if (missionError) {
        throw missionError;
      }

      // 先取得階級資料
      const {
        data,
        error,
      } = await supabase.rpc(
        "get_world_hierarchy"
      );

      if (error) {
        throw error;
      }

      const hierarchyData =
        (data ?? []) as Omit<
          HierarchyRow,
          "equipped_title_item_id"
        >[];

      if (hierarchyData.length === 0) {
        setRows([]);
        setTitles([]);
        return;
      }

      // 取得玩家目前裝備的稱號 id
      const playerIds =
        hierarchyData.map(
          (row) => row.player_id
        );

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(`
          id,
          equipped_title_item_id
        `)
        .in("id", playerIds);

      if (profileError) {
        throw profileError;
      }

      const titleIdMap =
        new Map<
          string,
          string | null
        >();

      (
        profileData ?? []
      ).forEach((profile) => {
        titleIdMap.set(
          profile.id,
          profile.equipped_title_item_id
        );
      });

      const mergedRows: HierarchyRow[] =
        hierarchyData.map(
          (row) => ({
            ...row,
            equipped_title_item_id:
              titleIdMap.get(
                row.player_id
              ) ?? null,
          })
        );

      setRows(mergedRows);

      const titleIds = [
        ...new Set(
          mergedRows
            .map(
              (row) =>
                row.equipped_title_item_id
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            )
        ),
      ];

      if (titleIds.length === 0) {
        setTitles([]);
        return;
      }

      const {
        data: titleData,
        error: titleError,
      } = await supabase
        .from("world_shop_items")
        .select(`
          id,
          name
        `)
        .in("id", titleIds);

      if (titleError) {
        throw titleError;
      }

      setTitles(
        (titleData ?? []) as TitleItem[]
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "讀取世界階級圖時發生錯誤。"
      );
    } finally {
      setLoading(false);
    }
  }

  const tree = useMemo(() => {
    const nodeMap =
      new Map<string, TreeNode>();

    rows.forEach((row) => {
      nodeMap.set(
        row.player_id,
        {
          ...row,
          children: [],
        }
      );
    });

    const roots: TreeNode[] = [];

    nodeMap.forEach((node) => {
      if (
        node.superior_id &&
        nodeMap.has(node.superior_id)
      ) {
        nodeMap
          .get(node.superior_id)!
          .children.push(node);
      } else {
        roots.push(node);
      }
    });

    function sortNodes(
      nodes: TreeNode[]
    ) {
      nodes.sort(
        (a, b) =>
          a.join_sequence -
          b.join_sequence
      );

      nodes.forEach((node) =>
        sortNodes(node.children)
      );
    }

    sortNodes(roots);

    return roots;
  }, [rows]);

  function getTitle(
    node: TreeNode
  ) {
    if (
      !node.equipped_title_item_id
    ) {
      return null;
    }

    return (
      titles.find(
        (title) =>
          title.id ===
          node.equipped_title_item_id
      ) ?? null
    );
  }

  function formatSequence(
    sequence: number
  ) {
    return String(sequence).padStart(
      6,
      "0"
    );
  }

  function getGenderLabel(
    gender: HierarchyRow["gender"]
  ) {
    if (gender === "female") {
      return "女性";
    }

    if (gender === "male") {
      return "男性";
    }

    return "其他";
  }

  function getRelationLabel(
    relationType: string | null
  ) {
    if (!relationType) {
      return null;
    }

    if (
      relationType === "automatic"
    ) {
      return "系統分配";
    }

    if (
      relationType === "voluntary"
    ) {
      return "自願歸屬";
    }

    return relationType;
  }

  function renderNode(
    node: TreeNode,
    depth = 0
  ) {
    const relationLabel =
      getRelationLabel(
        node.relation_type
      );

    const title =
      getTitle(node);

    return (
      <div
        key={node.player_id}
        className={
          depth === 0
            ? ""
            : "ml-5 border-l border-neutral-800 pl-5"
        }
      >
        <Link
          href={`/members/${node.player_id}`}
          className="mb-3 block rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition hover:border-neutral-600 hover:bg-neutral-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {title && (
                <p className="mb-1 text-xs font-medium text-amber-300">
                  「{title.name}」
                </p>
              )}

              <p className="text-lg font-medium">
                {node.nickname}
              </p>

              <p className="mt-1 text-sm text-neutral-500">
                序號{" "}
                {formatSequence(
                  node.join_sequence
                )}
                {" ・ "}
                {getGenderLabel(
                  node.gender
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {title && (
                <span className="rounded-full border border-amber-900/60 bg-amber-950/20 px-3 py-1 text-xs text-amber-300">
                  {title.name}
                </span>
              )}

              {relationLabel && (
                <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400">
                  {relationLabel}
                </span>
              )}
            </div>
          </div>
        </Link>

        {node.children.length > 0 && (
          <div className="space-y-3">
            {node.children.map(
              (child) =>
                renderNode(
                  child,
                  depth + 1
                )
            )}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界階級圖…
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
              世界階級圖
            </h1>

            <p className="mt-3 text-neutral-400">
              查看目前世界中的歸屬、階級與玩家稱號。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              世界商店
            </Link>

            <Link
              href="/daily-missions"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              每日任務
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

        <section className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              世界成員
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {rows.length}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <p className="text-sm text-neutral-500">
              獨立階級樹
            </p>

            <p className="mt-2 text-3xl font-semibold">
              {tree.length}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          {tree.length === 0 ? (
            <div className="rounded-xl bg-neutral-950 p-5 text-neutral-400">
              目前還沒有世界階級資料。
            </div>
          ) : (
            <div className="space-y-6">
              {tree.map((node) =>
                renderNode(node)
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}