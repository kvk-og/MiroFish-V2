import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  type NodeProps,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GraphData, GraphNode, GraphEdge } from "@/lib/api";

/* ---------- helpers ---------- */

const GROUP_COLORS: Record<string, string> = {
  A: "#3b82f6",
  B: "#a855f7",
  C: "#f59e0b",
  D: "#10b981",
  E: "#ef4444",
};

const ENTITY_COLORS: Record<string, string> = {
  concept: "#6366f1",
  location: "#14b8a6",
  resource: "#f97316",
  event: "#ec4899",
};

function sentimentColor(s: string): string {
  switch (s) {
    case "positive":
      return "#22c55e";
    case "negative":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

function groupColor(node: GraphNode): string {
  if (node.type === "agent") {
    return GROUP_COLORS[node.group] || GROUP_COLORS.A;
  }
  return ENTITY_COLORS[node.type] || ENTITY_COLORS.concept;
}

/* ---------- custom nodes ---------- */

function AgentNode({ data }: NodeProps) {
  const color = data.color as string;
  const label = data.label as string;
  return (
    <div
      style={{
        background: color,
        borderRadius: "50%",
        width: 48,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: 11,
        boxShadow: `0 0 12px ${color}55`,
        border: "2px solid rgba(255,255,255,0.2)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span className="truncate px-1 text-center leading-tight">{label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

function EntityNode({ data }: NodeProps) {
  const color = data.color as string;
  const label = data.label as string;
  const entityType = data.entityType as string;
  const shape: Record<string, string> = {
    concept: "8px",
    location: "4px",
    resource: "50%",
    event: "12px 4px",
  };
  return (
    <div
      style={{
        background: `${color}22`,
        borderRadius: shape[entityType] || "8px",
        border: `2px solid ${color}`,
        padding: "4px 10px",
        color: color,
        fontWeight: 600,
        fontSize: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span className="truncate text-center">{label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  agent: AgentNode,
  entity: EntityNode,
};

/* ---------- component ---------- */

interface KnowledgeGraphProps {
  graph: GraphData;
}

export function KnowledgeGraph({ graph }: KnowledgeGraphProps) {
  const toNodes = useCallback((): Node[] => {
    // Simple force-directed-like initial layout using circular placement
    const agentNodes = graph.nodes.filter((n) => n.type === "agent");
    const entityNodes = graph.nodes.filter((n) => n.type !== "agent");
    const totalAgents = agentNodes.length;
    const totalEntities = entityNodes.length;

    const agentRadius = 180;
    const entityRadius = 320;

    return graph.nodes.map((n, i) => {
      const isAgent = n.type === "agent";
      const pool = isAgent ? agentNodes : entityNodes;
      const idx = pool.indexOf(n);
      const count = isAgent ? totalAgents : totalEntities;
      const r = isAgent ? agentRadius : entityRadius;
      const angle = count > 0 ? (2 * Math.PI * idx) / count : 0;
      return {
        id: n.id,
        type: isAgent ? "agent" : "entity",
        position: { x: r * Math.cos(angle), y: r * Math.sin(angle) },
        data: {
          label: n.label,
          color: groupColor(n),
          entityType: n.type,
        },
      };
    });
  }, [graph]);

  const toEdges = useCallback((): Edge[] => {
    return graph.edges.map((e: GraphEdge, i: number) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.sentiment === "positive",
      style: {
        stroke: sentimentColor(e.sentiment),
        strokeWidth: Math.max(1, Math.min(5, e.strength)),
      },
      labelStyle: {
        fill: "#9ca3af",
        fontSize: 10,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: "#0a0a0a",
        fillOpacity: 0.8,
      },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: sentimentColor(e.sentiment),
        width: 16,
        height: 16,
      },
    }));
  }, [graph]);

  const initialNodes = useMemo(() => toNodes(), [toNodes]);
  const initialEdges = useMemo(() => toEdges(), [toEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <Card className="w-full h-full flex flex-col border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            Knowledge Graph
            <Badge variant="secondary" className="text-xs">
              {graph.nodes.length} nodes &middot; {graph.edges.length} edges
            </Badge>
          </span>
        </CardTitle>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Agent
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" /> Concept
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-500 inline-block" /> Location
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Resource
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-pink-500 inline-block" /> Event
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-green-500 inline-block" /> Positive
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-red-500 inline-block" /> Negative
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-gray-500 inline-block" /> Neutral
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden rounded-b-lg" style={{ minHeight: 400 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: "#0a0a0a" }}
          defaultEdgeOptions={{ type: "default" }}
        >
          <Background gap={20} size={1} color="#1f2937" />
          <Controls
            showInteractive={false}
            style={{
              background: "rgba(15,15,15,0.8)",
              borderRadius: 8,
              borderColor: "#1f2937",
            }}
          />
          <MiniMap
            nodeColor={(n) => (n.data?.color as string) || "#6b7280"}
            style={{
              background: "rgba(15,15,15,0.8)",
              border: "1px solid #1f2937",
              borderRadius: 8,
            }}
            maskColor="rgba(0,0,0,0.6)"
          />
        </ReactFlow>
      </CardContent>
    </Card>
  );
}
