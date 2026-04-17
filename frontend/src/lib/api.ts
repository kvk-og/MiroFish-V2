declare global {
  interface Window {
    __MIROFISH_ENV__?: { VITE_API_URL?: string; VITE_WS_URL?: string };
  }
}

const API_BASE =
  window.__MIROFISH_ENV__?.VITE_API_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";
const WS_BASE =
  window.__MIROFISH_ENV__?.VITE_WS_URL ||
  import.meta.env.VITE_WS_URL ||
  "ws://localhost:8000";

export interface Agent {
  id: string;
  name: string;
  bio: string;
}

export interface UserProfile {
  location?: string;
  age?: number;
  occupation?: string;
  social_handles?: string[];
  social_factors?: string;
  survey_motivation?: string;
  survey_domain?: string;
  survey_history?: string;
  survey_news_focus?: string;
}

export interface BotConfig {
  creativity: string;
  strictness: string;
  devils_advocate: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "agent" | "concept" | "location" | "resource" | "event";
  group: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  sentiment: "positive" | "negative" | "neutral";
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Simulation {
  simulation_id: string;
  status: string;
  world_facts: string[];
  agents: Agent[];
  social_context?: string;
  graph?: GraphData;
}

export interface FeedItem {
  id?: string;
  agent_name: string;
  agent_id: string;
  action_type: string;
  content: string;
  target_id?: string;
  timestamp: string;
  platform: string;
}

export interface SimStatus {
  simulation_id: string;
  status: string;
  current_round: number;
  max_rounds: number;
  agents: number;
}

export interface SurveyQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface SimulationReport {
  decision: string;
  summary: string;
  key_takeaways: string[];
  analytics?: {
    sentiment_trend: { round: number; sentiment: string; score: number }[];
    opinion_distribution: { pro: number; anti: number; neutral: number };
    opinion_shifts: { agent: string; from: string; to: string; reason: string }[];
  };
}

export async function generateSurveyQuestions(scenario: string): Promise<SurveyQuestion[]> {
  const res = await fetch(`${API_BASE}/simulation/survey_questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.questions;
}

export async function uploadContextDocument(file: File): Promise<{ filename: string; extracted_text: string }> {
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch(`${API_BASE}/simulation/upload_context`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createSimulation(
  scenario: string,
  platform: string = "twitter",
  maxRounds: number = 10,
  userProfile?: UserProfile,
  numAgents: number = 3,
  botConfig?: BotConfig
): Promise<Simulation> {
  const body: Record<string, unknown> = { 
    scenario, 
    platform, 
    max_rounds: maxRounds,
    num_agents: numAgents
  };
  if (userProfile) {
    if (botConfig) {
      userProfile.social_factors = (userProfile.social_factors || "") + 
        ` [Bot Config: ${botConfig.creativity} creativity, ${botConfig.strictness} strictness${botConfig.devils_advocate ? ', DEVILS_ADVOCATE_MODE_ENABLED' : ''}]`;
    }
    body.user_profile = userProfile;
  } else if (botConfig) {
    body.user_profile = {
      social_factors: `[Bot Config: ${botConfig.creativity} creativity, ${botConfig.strictness} strictness${botConfig.devils_advocate ? ', DEVILS_ADVOCATE_MODE_ENABLED' : ''}]`
    };
  }
  const res = await fetch(`${API_BASE}/simulation/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function startSimulation(simId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/simulation/${simId}/start`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pauseSimulation(simId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/simulation/${simId}/pause`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function resumeSimulation(simId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/simulation/${simId}/resume`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function stopSimulation(simId: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/simulation/${simId}/stop`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSimulationStatus(simId: string): Promise<SimStatus> {
  const res = await fetch(`${API_BASE}/simulation/${simId}/status`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFeed(simId: string, limit: number = 50): Promise<{ feed: FeedItem[] }> {
  const res = await fetch(`${API_BASE}/simulation/${simId}/feed?limit=${limit}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getGraph(simId: string): Promise<GraphData> {
  const res = await fetch(`${API_BASE}/simulation/${simId}/graph`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  // API returns {simulation_id, round, graph: {nodes, edges}}
  if (data.graph) return data.graph;
  return data;
}

export async function getSimulationReport(simId: string): Promise<SimulationReport> {
  const res = await fetch(`${API_BASE}/simulation/${simId}/report`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.report;
}

export async function fetchHistory(): Promise<any> {
  const res = await fetch(`${API_BASE}/simulations/history`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function fetchHistoricalSimulation(simId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/simulations/history/${simId}`);
  if (!res.ok) throw new Error("Failed to fetch historical simulation");
  return res.json();
}

export function connectWebSocket(simId: string, onMessage: (data: any) => void): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/${simId}`);
  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {}
  };
  ws.onclose = () => {
    setTimeout(() => connectWebSocket(simId, onMessage), 3000);
  };
  return ws;
}
