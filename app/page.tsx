"use client";

import { useState, useRef } from "react";
import ForceGraph2D from "react-force-graph-2d";

export default function Home() {
  const [graphData, setGraphData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const [baseTrust, setBaseTrust] = useState(60);
  const [insiderCount, setInsiderCount] = useState(5);
  const [outsiderCount, setOutsiderCount] = useState(5);

  const [node0Type, setNode0Type] = useState<"insider" | "normal" | "outsider">("normal");
  const [node0LoosenessMode, setNode0LoosenessMode] = useState<"random" | "manual">("random");
  const [node0Looseness, setNode0Looseness] = useState(50);

  const [steps, setSteps] = useState(5);
  const [cutoffStep, setCutoffStep] = useState(3);

  const [graphFrozen, setGraphFrozen] = useState(false);
  const [avgResult, setAvgResult] = useState<any>(null);

  const frozenGraphRef = useRef<any>(null);

  // ★ 그래프 구조 생성
  function buildGraph() {
    const nodeCount = 25;
    let neighbors: Record<number, number[]> = {};
    let trustMap: Record<string, number> = {};
    let looseness: Record<number, number> = {};

    for (let i = 0; i < nodeCount; i++) {
      neighbors[i] = [];
      looseness[i] = Math.floor(Math.random() * 100);
    }

    if (node0LoosenessMode === "manual") {
      looseness[0] = node0Looseness;
    }

    let insiders = new Set<number>();
    let outsiders = new Set<number>();

    if (node0Type === "insider") insiders.add(0);
    else if (node0Type === "outsider") outsiders.add(0);

    while (insiders.size < insiderCount) {
      let x = Math.floor(Math.random() * nodeCount);
      if (!outsiders.has(x)) insiders.add(x);
    }
    while (outsiders.size < outsiderCount) {
      let x = Math.floor(Math.random() * nodeCount);
      if (!insiders.has(x)) outsiders.add(x);
    }

    const targetFriends: Record<number, number> = {};
    for (let i = 0; i < nodeCount; i++) {
      if (insiders.has(i)) targetFriends[i] = 6;
      else if (outsiders.has(i)) targetFriends[i] = 2;
      else targetFriends[i] = 4;
    }

    // 양방향 친구 매칭
    let attempts = 0;
    const maxAttempts = nodeCount * nodeCount * 2;

    while (attempts < maxAttempts) {
      attempts++;

      const needsMore: number[] = [];
      for (let i = 0; i < nodeCount; i++) {
        if (neighbors[i].length < targetFriends[i]) needsMore.push(i);
      }
      if (needsMore.length < 2) break;

      needsMore.sort(
        (a, b) =>
          targetFriends[a] - neighbors[a].length -
          (targetFriends[b] - neighbors[b].length)
      );

      const i = needsMore[needsMore.length - 1];
      const candidates = needsMore.filter(
        (j) => j !== i && !neighbors[i].includes(j)
      );
      if (candidates.length === 0) break;

      const j = candidates[Math.floor(Math.random() * candidates.length)];

      neighbors[i].push(j);
      neighbors[j].push(i);

      trustMap[`${i}-${j}`] = Math.floor(Math.random() * 100);
      trustMap[`${j}-${i}`] = Math.floor(Math.random() * 100);
    }

    // ★ 각 노드가 나를 몇 순위로 여기는지 (1~nodeCount, 중복 없음)
    // 0번이 곧 1순위, ... 식으로 셔플
    const ranks: number[] = [];
    for (let i = 1; i <= nodeCount; i++) ranks.push(i);
    // Fisher-Yates
    for (let i = ranks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
    }
    const theirRankOfMe: Record<number, number> = {};
    for (let i = 0; i < nodeCount; i++) {
      theirRankOfMe[i] = ranks[i];
    }

    // ★ 내가 각 노드를 몇 순위로 여기는지 (정보 표시용, 별도 셔플)
    const myRanks: number[] = [];
    for (let i = 1; i <= nodeCount; i++) myRanks.push(i);
    for (let i = myRanks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [myRanks[i], myRanks[j]] = [myRanks[j], myRanks[i]];
    }
    const myRankOf: Record<number, number> = {};
    for (let i = 0; i < nodeCount; i++) {
      myRankOf[i] = myRanks[i];
    }

    let reputation: Record<number, number> = {};
    for (let i = 0; i < nodeCount; i++) {
      reputation[i] = Math.floor(Math.random() * 100);
    }

    return {
      neighbors,
      trustMap,
      looseness,
      theirRankOfMe,
      myRankOf,
      reputation,
      nodeCount,
    };
  }

  // ★ 시뮬레이션 실행
  function runOneSim(graph: any) {
    const { neighbors, trustMap, looseness, theirRankOfMe, nodeCount } = graph;

    const myFriends = new Set(neighbors[0]);
    myFriends.add(0);

    let informed = new Set([0]);
    let frontier = [0];
    let depthMap: Record<number, number> = { 0: 1 };
    let parent: Record<number, number | null> = { 0: null };
    let spreadEdges = new Set<string>();

    for (let s = 0; s < steps; s++) {
      let next: number[] = [];
      const currentDepth = s + 2;

      for (let u of frontier) {
        for (let v of neighbors[u]) {
          if (informed.has(v)) continue;

          if (currentDepth > cutoffStep) {
            const vFriends = neighbors[v] || [];
            const hasOverlap = vFriends.some((f: number) => myFriends.has(f));
            if (!hasOverlap) continue;
          }

          // ★ 비밀 지킴 로직: 의지(순위) + 능력(입싼 정도)
          // 1순위에 가까울수록 지키고 싶은 의지 ↑
          const rankFactor = 1 - (theirRankOfMe[u] - 1) / (nodeCount - 1);
          const wantsToKeep = Math.random() < rankFactor;
          const cantHelp = Math.random() < looseness[u] / 100;
          if (wantsToKeep && !cantHelp) continue;

          let edgeTrust = trustMap[`${u}-${v}`] ?? 0;
          if (u === 0) {
            edgeTrust = (edgeTrust * baseTrust) / 100;
          }

          let believe = Math.random() < edgeTrust / 100;

          if (!believe) {
            const rumorSpreadProb = 0.7;
            if (Math.random() < rumorSpreadProb) {
              if (Math.random() < looseness[u] / 100) {
                informed.add(v);
                next.push(v);
                parent[v] = u;
                depthMap[v] = currentDepth;
                spreadEdges.add(`${u}-${v}`);
              }
            }
            continue;
          }

          const spreadProb = (100 - edgeTrust) / 100;
          if (Math.random() < spreadProb) {
            if (Math.random() < looseness[u] / 100) {
              informed.add(v);
              next.push(v);
              parent[v] = u;
              depthMap[v] = currentDepth;
              spreadEdges.add(`${u}-${v}`);
            }
          }
        }
      }

      frontier = next;
    }

    // "날 모르는 사람"한테 도달한 정도 계산
const directFriends = new Set(neighbors[0]);
directFriends.add(0);

let strangerReached = 0;
const totalStrangers = nodeCount - directFriends.size;

for (const id of informed) {
  if (!directFriends.has(id)) strangerReached++;
}

return {
  informed,
  depthMap,
  parent,
  spreadEdges,
  strangerReached,
  totalStrangers,
};
  }

  function runSimulation() {
    let graph;
    if (graphFrozen && frozenGraphRef.current) {
      graph = frozenGraphRef.current;
    } else {
      graph = buildGraph();
      frozenGraphRef.current = graph;
    }

    const { informed, depthMap, parent, spreadEdges, strangerReached, totalStrangers } = runOneSim(graph);
    const {
      neighbors,
      trustMap,
      looseness,
      theirRankOfMe,
      myRankOf,
      reputation,
      nodeCount,
    } = graph;

    const nodes: any[] = [];

    nodes.push({
      id: -1,
      label: "나",
      color: "green",
      depth: 0,
    });

    for (let i = 0; i < nodeCount; i++) {
      let color = "gray";
      if (i === 0) color = "blue";
      else if (informed.has(i)) color = "red";

      nodes.push({
        id: i,
        label: String(i),
        color,
        myRankOf: myRankOf[i],
        theirRankOfMe: theirRankOfMe[i],
        parent: parent[i] ?? null,
        looseness: looseness[i],
        reputation: reputation[i],
        depth: depthMap[i] ?? null,
      });
    }

    const links: any[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < nodeCount; i++) {
      for (const j of neighbors[i]) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const spread =
          spreadEdges.has(`${i}-${j}`) || spreadEdges.has(`${j}-${i}`);
        links.push({ source: i, target: j, spread });
      }
    }

    links.push({ source: -1, target: 0, spread: true });

    setGraphData({ nodes, links, neighbors, trustMap });
    setResult({
  informed: informed.size,
  strangerReached,
  totalStrangers,
});
    setAvgResult(null);
  }

  function runAverageSimulation() {
  const N = 100;
  let total = 0;
  let totalStrangerReached = 0;
  let totalStrangerCount = 0;
  let depthCounts: number[] = new Array(20).fill(0);

  let graph;
  if (graphFrozen && frozenGraphRef.current) {
    graph = frozenGraphRef.current;
  }

  for (let k = 0; k < N; k++) {
    const g = graph ?? buildGraph();
    const { informed, depthMap, strangerReached, totalStrangers } = runOneSim(g);
    total += informed.size;
    totalStrangerReached += strangerReached;
    totalStrangerCount = totalStrangers; // 같은 그래프면 고정값
    for (const id of informed) {
      const d = depthMap[id as number] ?? 0;
      if (d < depthCounts.length) depthCounts[d]++;
    }
  }

  const avgDepthCounts = depthCounts.map((c) => (c / N).toFixed(2));
  setAvgResult({
    avg: (total / N).toFixed(2),
    avgStranger: (totalStrangerReached / N).toFixed(2),
    totalStrangers: totalStrangerCount,
    runs: N,
    depthCounts: avgDepthCounts,
  });
}

  return (
    <main style={{ padding: 20 }}>
      <h1>Should I Tell?</h1>

      <p>노드 0이 나를 신뢰하는 정도(=내 말이 사실이라고 믿는 정도): {baseTrust}</p>
      <input
        type="range"
        min="0"
        max="100"
        value={baseTrust}
        onChange={(e) => setBaseTrust(parseInt(e.target.value))}
      />

      <p>전체 인싸 수: {insiderCount}</p>
      <input
        type="range"
        min="0"
        max="15"
        value={insiderCount}
        onChange={(e) => setInsiderCount(parseInt(e.target.value))}
      />

      <p>전체 아싸 수: {outsiderCount}</p>
      <input
        type="range"
        min="0"
        max="15"
        value={outsiderCount}
        onChange={(e) => setOutsiderCount(parseInt(e.target.value))}
      />

      <div style={{ marginTop: 16 }}>
        <p>노드 0(내가 말할 사람) 타입:</p>
        <button
          onClick={() => setNode0Type("insider")}
          style={{
            background: node0Type === "insider" ? "lightblue" : "white",
            marginRight: 4,
          }}
        >
          인싸
        </button>
        <button
          onClick={() => setNode0Type("normal")}
          style={{
            background: node0Type === "normal" ? "lightblue" : "white",
            marginRight: 4,
          }}
        >
          일반
        </button>
        <button
          onClick={() => setNode0Type("outsider")}
          style={{
            background: node0Type === "outsider" ? "lightblue" : "white",
          }}
        >
          아싸
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <p>노드 0의 입이 싼 정도:</p>
        <button
          onClick={() => setNode0LoosenessMode("random")}
          style={{
            background: node0LoosenessMode === "random" ? "lightblue" : "white",
            marginRight: 4,
          }}
        >
          랜덤
        </button>
        <button
          onClick={() => setNode0LoosenessMode("manual")}
          style={{
            background: node0LoosenessMode === "manual" ? "lightblue" : "white",
          }}
        >
          직접 설정
        </button>
        {node0LoosenessMode === "manual" && (
          <div>
            <p>입이 싼 정도: {node0Looseness}</p>
            <input
              type="range"
              min="0"
              max="100"
              value={node0Looseness}
              onChange={(e) => setNode0Looseness(parseInt(e.target.value))}
            />
          </div>
        )}
      </div>

      <p>전파 단계 수: {steps}</p>
      <input
        type="range"
        min="1"
        max="10"
        value={steps}
        onChange={(e) => setSteps(parseInt(e.target.value))}
      />

      <p>겹지인 체크 시작 단계: {cutoffStep}</p>
      <input
        type="range"
        min="1"
        max="10"
        value={cutoffStep}
        onChange={(e) => setCutoffStep(parseInt(e.target.value))}
      />

      <div style={{ marginTop: 16 }}>
        <label>
          <input
            type="checkbox"
            checked={graphFrozen}
            onChange={(e) => setGraphFrozen(e.target.checked)}
          />
          그래프 고정 (같은 친구 관계로 다시 시뮬)
        </label>
      </div>

      <br />
      <button onClick={runSimulation} style={{ marginTop: 12, marginRight: 8 }}>
        시뮬레이션 실행
      </button>
      <button onClick={runAverageSimulation} style={{ marginTop: 12 }}>
        100번 평균 실행
      </button>

      {result && (
        <div style={{ marginTop: 12 }}>
          <p>소문 전달된 사람 수: {result.informed}</p>
          <p>
            나와 직접 친구 아닌 사람한테 도달: {result.strangerReached} / {result.totalStrangers}
          </p>
        </div>
      )}

      {avgResult && (
      <div style={{ marginTop: 12, padding: 10, border: "1px solid #888" }}>
        <p>{avgResult.runs}번 평균</p>
        <p>평균 전파 인원: {avgResult.avg}명</p>
        <p>
          평균 "날 모르는 사람"한테 도달: {avgResult.avgStranger} / {avgResult.totalStrangers}명
        </p>
        <p>단계별 평균 전파 인원:</p>
        <ul>
          {avgResult.depthCounts.map((c: string, i: number) =>
            parseFloat(c) > 0 ? (
              <li key={i}>
                {i}단계: {c}명
              </li>
            ) : null
          )}
        </ul>
      </div>
    )}
      {selectedNode && graphData && selectedNode.id !== -1 && (
        <div
          style={{
            border: "1px solid black",
            padding: 10,
            marginTop: 12,
            position: "relative",
          }}
        >
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            ✕
          </button>
          <p>노드: {selectedNode.id}</p>
          <p>나로부터 단계: {selectedNode.depth ?? "전파 안 됨"}</p>
          <p>내가 보는 이 사람의 순위: {selectedNode.myRankOf}순위</p>
          <p>이 사람이 보는 나의 순위: {selectedNode.theirRankOfMe}순위</p>
          <p>입이 싼 정도: {selectedNode.looseness}</p>
          <p>평판: {selectedNode.reputation}</p>
          <p>누구에게서 들었나: {selectedNode.parent ?? "초기(나로부터)"}</p>

          <p>친구:</p>
          <ul>
            {(graphData.neighbors[selectedNode.id] || []).map((v: number) => {
              const trustOut = graphData.trustMap[`${selectedNode.id}-${v}`] ?? 0;
              const trustIn = graphData.trustMap[`${v}-${selectedNode.id}`] ?? 0;
              return (
                <li key={v}>
                  → {v} | 내가 신뢰: {trustOut} | 상대가 신뢰: {trustIn}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selectedNode && selectedNode.id === -1 && (
        <div
          style={{
            border: "1px solid green",
            padding: 10,
            marginTop: 12,
            position: "relative",
          }}
        >
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            ✕
          </button>
          <p>나 (비밀의 원천)</p>
          <p>노드 0에게 비밀을 말했음</p>
        </div>
      )}

      {graphData && (
        <div style={{ height: 400 }}>
          <ForceGraph2D
            graphData={graphData}
            onNodeClick={(node: any) => setSelectedNode(node)}
            nodeCanvasObject={(node: any, ctx, scale) => {
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
        </div>
      )}
    </main>
  );
}