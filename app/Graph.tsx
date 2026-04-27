"use client";

import ForceGraph2D from "react-force-graph-2d";

export default function Graph({ graphData, setSelectedNode }: any) {
  // 안전망: window 없으면 렌더 안 함
  if (typeof window === "undefined") return null;

  return (
    <ForceGraph2D
      graphData={graphData}
      onNodeClick={(node: any) => setSelectedNode(node)}
      nodeCanvasObject={(node: any, ctx: any, scale: number) => {
        const fontSize = 12 / scale;

        ctx.fillStyle = node.color;
        ctx.beginPath();
        const radius = node.id === -1 ? 8 : 5;
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.fillStyle = "black";
        ctx.fillText(node.label, node.x + 6, node.y + 6);
      }}
    />
  );
}