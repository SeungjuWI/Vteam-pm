"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  Handle,
  Position,
  type OnConnect,
  type OnEdgesDelete,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { updateReportsTo, type OrgMember } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  admin: "관리자",
  employee: "직원",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "border-blue-400 bg-blue-50",
  employee: "border-gray-300 bg-white",
};

function MemberNode({ data }: NodeProps) {
  const d = data as { name: string; position: string; role: string; avatarUrl: string };
  return (
    <div
      className={`rounded-2xl border-2 px-4 py-3 text-center ${ROLE_COLORS[d.role] ?? "border-gray-300 bg-white"}`}
      style={{ minWidth: 140 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !h-2 !w-2" />
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gray-100">
        {d.avatarUrl ? (
          <Image src={d.avatarUrl} alt={d.name} width={40} height={40} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-medium text-gray-500">{(d.name as string)[0]}</span>
        )}
      </div>
      <p className="text-sm font-medium text-gray-900">{d.name}</p>
      {d.position && <p className="text-xs text-gray-500">{d.position}</p>}
      <p className="mt-0.5 text-[10px] text-gray-600">{ROLE_LABELS[d.role] ?? d.role}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !h-2 !w-2" />
    </div>
  );
}

const nodeTypes = { member: MemberNode };

const STORAGE_KEY = "vteam-org-chart-positions";

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePositions(nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n) => {
    positions[n.id] = { x: n.position.x, y: n.position.y };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // storage full or unavailable
  }
}

function buildLayout(members: OrgMember[]) {
  // 루트 노드 (reports_to가 없는 멤버) 찾기
  const childrenMap = new Map<string | "root", OrgMember[]>();
  childrenMap.set("root", []);

  members.forEach((m) => {
    const parentKey = m.reportsTo ?? "root";
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(m);
  });

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const X_GAP = 200;
  const Y_GAP = 140;

  // BFS로 위치 계산
  type QueueItem = { id: string; depth: number };
  const queue: QueueItem[] = [];
  const depthWidths = new Map<number, number>();

  // 루트 노드들
  const roots = childrenMap.get("root") ?? [];
  roots.forEach((m) => queue.push({ id: m.id, depth: 0 }));

  const visited = new Set<string>();
  const depthMembers = new Map<number, string[]>();

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (!depthMembers.has(depth)) depthMembers.set(depth, []);
    depthMembers.get(depth)!.push(id);

    const children = childrenMap.get(id) ?? [];
    children.forEach((c) => {
      if (!visited.has(c.id)) {
        queue.push({ id: c.id, depth: depth + 1 });
      }
    });
  }

  // 방문되지 않은 멤버도 추가 (orphan)
  members.forEach((m) => {
    if (!visited.has(m.id)) {
      const maxDepth = Math.max(...Array.from(depthMembers.keys()), -1) + 1;
      if (!depthMembers.has(maxDepth)) depthMembers.set(maxDepth, []);
      depthMembers.get(maxDepth)!.push(m.id);
    }
  });

  // 노드 생성 (저장된 위치가 있으면 적용)
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const savedPositions = loadSavedPositions();

  depthMembers.forEach((ids, depth) => {
    const totalWidth = (ids.length - 1) * X_GAP;
    const startX = -totalWidth / 2;

    ids.forEach((id, i) => {
      const m = memberMap.get(id);
      if (!m) return;
      const saved = savedPositions[m.id];
      nodes.push({
        id: m.id,
        type: "member",
        position: saved
          ? { x: saved.x, y: saved.y }
          : { x: startX + i * X_GAP, y: depth * Y_GAP },
        data: {
          name: m.name,
          position: m.position,
          role: m.role,
          avatarUrl: m.avatarUrl,
        },
      });
    });
  });

  // 엣지 생성
  members.forEach((m) => {
    if (m.reportsTo && memberMap.has(m.reportsTo)) {
      edges.push({
        id: `${m.reportsTo}-${m.id}`,
        source: m.reportsTo,
        target: m.id,
        type: "smoothstep",
        style: { stroke: "#d1d5db", strokeWidth: 2 },
      });
    }
  });

  return { nodes, edges };
}

export default function OrgChartView({
  initialMembers,
}: {
  initialMembers: OrgMember[];
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildLayout(initialMembers),
    [initialMembers],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  const onConnect: OnConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;

      // source -> target 방향: source가 상위자, target이 보고자
      setSaving(true);
      setMessage("");
      const result = await updateReportsTo(params.target, params.source);
      if (result.error) {
        setMessage(result.error);
      } else {
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              type: "smoothstep",
              style: { stroke: "#d1d5db", strokeWidth: 2 },
            },
            eds,
          ),
        );
        setMessage("조직도가 업데이트되었습니다.");
      }
      setSaving(false);
      setTimeout(() => setMessage(""), 2000);
    },
    [setEdges],
  );

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const onNodeDragStop = useCallback(() => {
    savePositions(nodesRef.current);
  }, []);

  const onEdgesDelete: OnEdgesDelete = useCallback(
    async (deletedEdges) => {
      setSaving(true);
      setMessage("");
      for (const edge of deletedEdges) {
        const result = await updateReportsTo(edge.target, null);
        if (result.error) {
          setMessage(result.error);
          setSaving(false);
          return;
        }
      }
      setMessage("연결이 해제되었습니다.");
      setSaving(false);
      setTimeout(() => setMessage(""), 2000);
    },
    [],
  );

  return (
    <div className="flex h-[calc(100vh-240px)] min-h-[480px] flex-col">
      <div className="flex items-center justify-between pb-4">
        <div>
          <p className="text-sm text-gray-500">
            노드를 드래그해서 위치를 옮기고, 하단 핸들에서 상단 핸들로 연결하면 보고 관계가 설정됩니다.
          </p>
        </div>
        {(saving || message) && (
          <span
            className={`rounded-lg px-3 py-1 text-xs ${
              saving
                ? "bg-gray-100 text-gray-500"
                : message.includes("오류") || message.includes("없") || message.includes("순환") || message.includes("권한")
                  ? "bg-red-50 text-red-500"
                  : "bg-green-50 text-green-600"
            }`}
          >
            {saving ? "저장 중..." : message}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: { stroke: "#d1d5db", strokeWidth: 2 },
          }}
        >
          <Background color="#f3f4f6" gap={20} />
          <Controls
            showInteractive={false}
            className="!rounded-xl !border-gray-200 !shadow-none [&>button]:!border-gray-200 [&>button]:!bg-white"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
