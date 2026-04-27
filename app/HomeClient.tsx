"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";

const Graph = dynamic(() => import("./Graph"), {
  ssr: false,
});


export default function HomeClient() {
  const [graphData, setGraphData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const [baseTrust, setBaseTrust] = useState(60);

  const [insiderMode, setInsiderMode] = useState<"manual" | "random">("manual");
  const [insiderCount, setInsiderCount] = useState(5);
  const [outsiderMode, setOutsiderMode] = useState<"manual" | "random">("manual");
  const [outsiderCount, setOutsiderCount] = useState(5);

  // ★ 나의 타입
  const [myType, setMyType] = useState<"insider" | "normal" | "outsider">("normal");

  const [node0Type, setNode0Type] = useState<"insider" | "normal" | "outsider">("normal");
  const [node0TightLippedMode, setNode0TightLippedMode] = useState<"random" | "manual">("random");
  const [node0TightLipped, setNode0TightLipped] = useState(50);

  const [steps, setSteps] = useState(5);

  const [graphFrozen, setGraphFrozen] = useState(false);
  const [avgResult, setAvgResult] = useState<any>(null);
  const [randomChoices, setRandomChoices] = useState<any>(null);

  const frozenGraphRef = useRef<any>(null);

  function buildGraph() {
    const nodeCount = 25; // 노드 0~24
    // ★ 나(-1)도 포함하는 통합 neighbors/trustMap 사용
    let neighbors: Record<number, number[]> = {};
    let trustMap: Record<string, number> = {};
    let tightLipped: Record<number, number> = {};

    // 모든 노드 + 나(-1) 초기화
    neighbors[-1] = [];
    for (let i = 0; i < nodeCount; i++) {
      neighbors[i] = [];
      tightLipped[i] = Math.floor(Math.random() * 100);
    }

    let chosenNode0TightLipped: number;
    if (node0TightLippedMode === "manual") {
      tightLipped[0] = node0TightLipped;
      chosenNode0TightLipped = node0TightLipped;
    } else {
      chosenNode0TightLipped = tightLipped[0];
    }

    const chosenInsiderCount = insiderMode === "random"
      ? Math.floor(Math.random() * 16)
      : insiderCount;
    const chosenOutsiderCount = outsiderMode === "random"
      ? Math.floor(Math.random() * 16)
      : outsiderCount;

    let insiders = new Set<number>();
    let outsiders = new Set<number>();

    if (node0Type === "insider") insiders.add(0);
    else if (node0Type === "outsider") outsiders.add(0);

    const safeInsider = Math.min(chosenInsiderCount, nodeCount);
    const safeOutsider = Math.min(chosenOutsiderCount, nodeCount - safeInsider);

    let insiderTries = 0;
    while (insiders.size < safeInsider && insiderTries < 1000) {
      insiderTries++;
      let x = Math.floor(Math.random() * nodeCount);
      if (!outsiders.has(x)) insiders.add(x);
    }
    let outsiderTries = 0;
    while (outsiders.size < safeOutsider && outsiderTries < 1000) {
      outsiderTries++;
      let x = Math.floor(Math.random() * nodeCount);
      if (!insiders.has(x)) outsiders.add(x);
    }

    // ★ 나의 친구 수
    const myTargetFriends = myType === "insider" ? 6 : myType === "outsider" ? 2 : 4;

    const targetFriends: Record<number, number> = {};
    targetFriends[-1] = myTargetFriends;
    for (let i = 0; i < nodeCount; i++) {
      if (insiders.has(i)) targetFriends[i] = 6;
      else if (outsiders.has(i)) targetFriends[i] = 2;
      else targetFriends[i] = 4;
    }

    // ★ 노드 0은 무조건 나의 친구
    neighbors[-1].push(0);
    neighbors[0].push(-1);
    trustMap[`-1-0`] = Math.floor(Math.random() * 100);
    trustMap[`0--1`] = Math.floor(Math.random() * 100);

    // 양방향 친구 매칭 (나 포함)
    let attempts = 0;
    const allNodes = [-1, ...Array.from({ length: nodeCount }, (_, i) => i)];
    const maxAttempts = allNodes.length * allNodes.length * 2;

    while (attempts < maxAttempts) {
      attempts++;

      const needsMore: number[] = [];
      for (const n of allNodes) {
        if (neighbors[n].length < targetFriends[n]) needsMore.push(n);
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

    const ranks: number[] = [];
    for (let i = 1; i <= nodeCount; i++) ranks.push(i);
    for (let i = ranks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
    }
    const theirRankOfMe: Record<number, number> = {};
    for (let i = 0; i < nodeCount; i++) {
      theirRankOfMe[i] = ranks[i];
    }

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
      tightLipped,
      theirRankOfMe,
      myRankOf,
      reputation,
      nodeCount,
      chosen: {
        insiderCount: chosenInsiderCount,
        outsiderCount: chosenOutsiderCount,
        node0TightLipped: chosenNode0TightLipped,
        myFriendCount: neighbors[-1].length,
      },
    };
  }

  function runOneSim(graph: any) {
    const { neighbors, trustMap, tightLipped, theirRankOfMe, nodeCount } = graph;

    // ★ 진짜 나의 친구들
    const myFriendsSet = new Set<number>(neighbors[-1] || []);

    let informed = new Set([0]);
    let frontier = [0];
    let depthMap: Record<number, number> = { 0: 1 };
    let parent: Record<number, number | null> = { 0: null };
    let spreadEdges = new Set<string>();

    const stimulation = steps / 10;

    for (let s = 0; s < steps; s++) {
      let next: number[] = [];
      const currentDepth = s + 2;

      for (let u of frontier) {
        for (let v of neighbors[u]) {
          if (v === -1) continue; // 나에게는 전파 안 됨 (이미 알고 있음)
          if (informed.has(v)) continue;

          // 비밀 지킴 게이트
          const adjustedTightLipped = tightLipped[u] * (1 - stimulation * 0.5);
          const rankFactor = 1 - (theirRankOfMe[u] - 1) / (nodeCount - 1);
          const wantsToKeep = Math.random() < rankFactor;
          const cantHelp = Math.random() < (100 - adjustedTightLipped) / 100;
          if (wantsToKeep && !cantHelp) continue;

          // u가 v를 신뢰하는 만큼 말함
          let edgeTrust = trustMap[`${u}-${v}`] ?? 0;
          if (u === 0) {
            edgeTrust = (edgeTrust * baseTrust) / 100;
          }

          // ★ 겹지인 부스트: v의 친구 중 나의 친구가 많을수록 잘 퍼짐
          const vFriends = neighbors[v] || [];
          const overlapCount = vFriends.filter((f: number) => myFriendsSet.has(f)).length;
          const overlapBoost = Math.min(overlapCount / 3, 1);
          // 겹지인 0명: 신뢰도의 30%만 효과, 3명+: 100% 효과
          const spreadProb = (edgeTrust / 100) * (0.3 + overlapBoost * 0.7);

          if (Math.random() < spreadProb) {
            informed.add(v);
            next.push(v);
            parent[v] = u;
            depthMap[v] = currentDepth;
            spreadEdges.add(`${u}-${v}`);
          }
        }
      }

      frontier = next;
    }

    // "날 모르는 사람"한테 도달 = 나의 친구가 아닌 사람
    let strangerReached = 0;
    const totalStrangers = nodeCount - myFriendsSet.size;

    for (const id of informed) {
      if (id === 0) continue; // 시작점 제외
      if (!myFriendsSet.has(id)) strangerReached++;
    }

    return {
      informed,
      depthMap,
      parent,
      spreadEdges,
      strangerReached,
      totalStrangers,
      myFriendsSet,
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

    const { informed, depthMap, parent, spreadEdges, strangerReached, totalStrangers, myFriendsSet } = runOneSim(graph);
    const {
      neighbors,
      trustMap,
      tightLipped,
      theirRankOfMe,
      myRankOf,
      reputation,
      nodeCount,
      chosen,
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
        tightLipped: tightLipped[i],
        reputation: reputation[i],
        depth: depthMap[i] ?? null,
        isMyFriend: myFriendsSet.has(i),
      });
    }

    // ★ 링크 생성: 나(-1)도 포함
    const links: any[] = [];
    const seen = new Set<string>();
    const allNodeIds = [-1, ...Array.from({ length: nodeCount }, (_, i) => i)];

    for (const i of allNodeIds) {
      for (const j of (neighbors[i] || [])) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const spread =
          spreadEdges.has(`${i}-${j}`) || spreadEdges.has(`${j}-${i}`);
        links.push({ source: i, target: j, spread });
      }
    }

    setGraphData({ nodes, links, neighbors, trustMap, myFriendsSet });
    setResult({
      informed: informed.size,
      strangerReached,
      totalStrangers,
    });
    setRandomChoices(chosen);
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
      totalStrangerCount = totalStrangers;
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
      <p style={{ fontSize: 18, color: "#666" }}>당신은 노드 0에게 비밀을 말합니다.</p>

      <p>노드 0이 나를 신뢰하는 정도(=내 말이 사실이라고 믿는 정도): {baseTrust}</p>
      <input
        type="range"
        min="0"
        max="100"
        value={baseTrust}
        onChange={(e) => setBaseTrust(parseInt(e.target.value))}
      />

      {/* ★ 나의 타입 */}
      <div style={{ marginTop: 16 }}>
        <p>(주어진 상황에서)나의 타입:</p>
        <button
          onClick={() => setMyType("insider")}
          style={{
            background: myType === "insider" ? "lightgreen" : "white",
            marginRight: 4,
          }}
        >
          인싸 (편히 말할 친구 10명 이상)
        </button>
        <button
          onClick={() => setMyType("normal")}
          style={{
            background: myType === "normal" ? "lightgreen" : "white",
            marginRight: 4,
          }}
        >
          일반
        </button>
        <button
          onClick={() => setMyType("outsider")}
          style={{
            background: myType === "outsider" ? "lightgreen" : "white",
          }}
        >
          아싸 (편히 상담할 친구 3명 이하)
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <p>노드 0의 주변인 중 인싸 수:</p>
        <button
          onClick={() => setInsiderMode("manual")}
          style={{
            background: insiderMode === "manual" ? "lightblue" : "white",
            marginRight: 4,
          }}
        >
          직접 설정
        </button>
        <button
          onClick={() => setInsiderMode("random")}
          style={{
            background: insiderMode === "random" ? "lightblue" : "white",
          }}
        >
          랜덤
        </button>
        {insiderMode === "manual" && (
          <div>
            <p>인싸 수: {insiderCount}</p>
            <input
              type="range"
              min="0"
              max="15"
              value={insiderCount}
              onChange={(e) => setInsiderCount(parseInt(e.target.value))}
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <p>노드 0의 주변인 중 아싸 수:</p>
        <button
          onClick={() => setOutsiderMode("manual")}
          style={{
            background: outsiderMode === "manual" ? "lightblue" : "white",
            marginRight: 4,
          }}
        >
          직접 설정
        </button>
        <button
          onClick={() => setOutsiderMode("random")}
          style={{
            background: outsiderMode === "random" ? "lightblue" : "white",
          }}
        >
          랜덤
        </button>
        {outsiderMode === "manual" && (
          <div>
            <p>아싸 수: {outsiderCount}</p>
            <input
              type="range"
              min="0"
              max="15"
              value={outsiderCount}
              onChange={(e) => setOutsiderCount(parseInt(e.target.value))}
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <p>노드 0(당신이 말할 사람) 타입:</p>
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
        <p>노드 0의 입이 무거운 정도:</p>
        <button
          onClick={() => setNode0TightLippedMode("manual")}
          style={{
            background: node0TightLippedMode === "manual" ? "lightblue" : "white",
            marginRight: 4,
          }}
        >
          직접 설정
        </button>
        <button
          onClick={() => setNode0TightLippedMode("random")}
          style={{
            background: node0TightLippedMode === "random" ? "lightblue" : "white",
          }}
        >
          랜덤
        </button>
        {node0TightLippedMode === "manual" && (
          <div>
            <p>입이 무거운 정도: {node0TightLipped}</p>
            <input
              type="range"
              min="0"
              max="100"
              value={node0TightLipped}
              onChange={(e) => setNode0TightLipped(parseInt(e.target.value))}
            />
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <p>소문의 자극성: {steps}</p>
        <p style={{ fontSize: 13, color: "#888" }}>
          (자극적일수록 더 멀리, 더 활발히 퍼집니다)
        </p>
        <input
          type="range"
          min="1"
          max="10"
          value={steps}
          onChange={(e) => setSteps(parseInt(e.target.value))}
        />
      </div>

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

      <button onClick={runAverageSimulation} style={{ marginTop: 12, marginLeft: 8 }}>
        100번 평균 실행
      </button>

      {randomChoices && (
        <div style={{ marginTop: 12, padding: 10, background: "#f5f5f5", border: "1px solid #ddd" }}>
          <p style={{ fontWeight: "bold", marginBottom: 4 }}>이번 시뮬레이션 설정</p>
          <p>
            인싸 수: {randomChoices.insiderCount}명
            {insiderMode === "random" && " (랜덤)"}
          </p>
          <p>
            아싸 수: {randomChoices.outsiderCount}명
            {outsiderMode === "random" && " (랜덤)"}
          </p>
          <p>
            노드 0의 입무거운 정도: {randomChoices.node0TightLipped}
            {node0TightLippedMode === "random" && " (랜덤)"}
          </p>
          <p>나의 친구 수: {randomChoices.myFriendCount}명</p>
        </div>
      )}

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
          {/* ★ 나와 친구 표시 */}
          {selectedNode.isMyFriend && (
            <p style={{ color: "green", fontWeight: "bold" }}>★ 나와 친구입니다</p>
          )}
          <p>내가 보는 이 사람의 순위: {selectedNode.myRankOf}순위</p>
          <p>이 사람이 보는 나의 순위: {selectedNode.theirRankOfMe}순위</p>
          <p>입이 무거운 정도: {selectedNode.tightLipped}</p>

          {selectedNode.depth != null ? (
            <>
              <p>나로부터 단계: {selectedNode.depth}</p>
              <p>
                누구에게서 들었나:{" "}
                {selectedNode.parent === null ? "초기(나로부터)" : selectedNode.parent}
              </p>
            </>
          ) : (
            <p style={{ color: "#888", fontStyle: "italic" }}>
              이 사람에게는 비밀이 전달되지 않았습니다
            </p>
          )}

          <p>친구:</p>
          <ul>
            {(graphData.neighbors[selectedNode.id] || []).map((v: number) => {
              const trustOut = graphData.trustMap[`${selectedNode.id}-${v}`] ?? 0;
              const trustIn = graphData.trustMap[`${v}-${selectedNode.id}`] ?? 0;
              const label = v === -1 ? "나" : v;
              return (
                <li key={v}>
                  → {label} | 내가 신뢰: {trustOut} | 상대가 신뢰: {trustIn}
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
          <p>친구 수: {graphData.neighbors[-1]?.length ?? 0}명</p>
          <p>친구:</p>
          <ul>
            {(graphData.neighbors[-1] || []).map((v: number) => (
              <li key={v}>→ {v}</li>
            ))}
          </ul>
        </div>
      )}

      {graphData && (
        <div style={{ height: 400 }}>
          <Graph
            graphData={graphData}
            setSelectedNode={setSelectedNode}
          />
        </div>
      )}
    </main>
  );
}