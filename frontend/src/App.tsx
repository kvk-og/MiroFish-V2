import { useState, useEffect, useRef, useCallback } from "react";
import { DiagnosticSurvey } from "./components/DiagnosticSurvey";
import { LiveFeed } from "./components/LiveFeed";
import { SimControls } from "./components/SimControls";
import { KnowledgeGraph } from "./components/KnowledgeGraph";
import { ReportViewer } from "./components/ReportViewer";
import {
  createSimulation,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stopSimulation,
  getSimulationStatus,
  getGraph,
  connectWebSocket,
  getSimulationReport,
  type Simulation,
  type FeedItem,
  type SimStatus,
  type GraphData,
  type UserProfile,
  type SimulationReport,
} from "./lib/api";

export default function App() {
  const [sim, setSim] = useState<Simulation | null>(null);
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load existing simulation from URL param ?sim=xxx
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const simId = params.get("sim");
    if (!simId) return;
    (async () => {
      try {
        const s = await getSimulationStatus(simId);
        setStatus(s);
        // Reconstruct a minimal sim object from status
        setSim({
          simulation_id: simId,
          status: s.status,
          world_facts: [],
          agents: [],
        });
        // Fetch feed
        const f = await (await fetch(`http://localhost:8000/simulation/${simId}/feed?limit=50`)).json();
        if (f.feed) setFeed(f.feed);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  // Poll status while simulation is active
  useEffect(() => {
    if (!sim) return;
    const interval = setInterval(async () => {
      try {
        const s = await getSimulationStatus(sim.simulation_id);
        setStatus(s);
        if (s.status === "completed" || s.status === "stopped" || s.status === "failed") {
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [sim]);

  // Fetch graph when simulation becomes active
  useEffect(() => {
    if (!sim) return;
    const fetchGraph = async () => {
      try {
        const g = await getGraph(sim.simulation_id);
        setGraph(g);
      } catch {
        // Graph endpoint may not exist yet — ignore
      }
    };
    fetchGraph();
    const interval = setInterval(fetchGraph, 5000);
    return () => clearInterval(interval);
  }, [sim]);

  // Connect WebSocket for live updates
  useEffect(() => {
    if (!sim) return;
    wsRef.current = connectWebSocket(sim.simulation_id, (data) => {
      if (data.event === "agent_action") {
        setFeed((prev) => [
          {
            id: data.data.id,
            agent_name: data.data.agent_name,
            agent_id: data.data.agent_id || "",
            action_type: data.data.action_type,
            content: data.data.content,
            target_id: data.data.target_id,
            timestamp: data.data.timestamp,
            platform: data.data.platform || "twitter",
          },
          ...prev,
        ]);
      }
      if (data.event === "graph_update") {
        if (data.data) {
          setGraph(data.data as GraphData);
        }
      }
    });
    return () => wsRef.current?.close();
  }, [sim]);

  const handleCreate = useCallback(
    async (
      scenario: string,
      platform: string,
      maxRounds: number,
      userProfile?: UserProfile,
      numAgents?: number,
      botConfig?: { creativity: string; strictness: string; devils_advocate: boolean }
    ) => {
      setLoading(true);
      setError(null);
      setFeed([]);
      setGraph(null);
      try {
        const result = await createSimulation(scenario, platform, maxRounds, userProfile, numAgents || 3, botConfig);
        setSim(result);
        window.history.replaceState({}, "", `?sim=${result.simulation_id}`);
        if (result.graph) {
          setGraph(result.graph);
        }
        const s = await getSimulationStatus(result.simulation_id);
        setStatus(s);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleStart = useCallback(async () => {
    if (!sim) return;
    setLoading(true);
    try {
      await startSimulation(sim.simulation_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sim]);

  const handlePause = useCallback(async () => {
    if (!sim) return;
    setLoading(true);
    try {
      await pauseSimulation(sim.simulation_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sim]);

  const handleResume = useCallback(async () => {
    if (!sim) return;
    setLoading(true);
    try {
      await resumeSimulation(sim.simulation_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sim]);

  const handleStop = useCallback(async () => {
    if (!sim) return;
    setLoading(true);
    try {
      await stopSimulation(sim.simulation_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [sim]);

  const handleReset = useCallback(() => {
    setSim(null);
    setStatus(null);
    setFeed([]);
    setGraph(null);
    setReport(null);
    setShowReport(false);
    setError(null);
  }, []);

  const handleViewReport = useCallback(async () => {
    if (!sim) return;
    if (report) {
      setShowReport(true);
      return;
    }
    setReportLoading(true);
    try {
      const r = await getSimulationReport(sim.simulation_id);
      setReport(r);
      setShowReport(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setReportLoading(false);
    }
  }, [sim, report]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              MF
            </div>
            <h1 className="text-xl font-bold">MiroFish</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">v2.0</span>
          </div>
          {sim && (
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              + New Simulation
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {!sim ? (
          <div className="flex justify-center">
            <DiagnosticSurvey onSubmit={handleCreate} loading={loading} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top row: Controls + Knowledge Graph */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <SimControls
                  status={status}
                  agents={sim.agents}
                  onStart={handleStart}
                  onPause={handlePause}
                  onResume={handleResume}
                  onStop={handleStop}
                  onViewReport={handleViewReport}
                  loading={loading || reportLoading}
                />
              </div>
              <div className="lg:col-span-2 min-h-[450px]">
                {graph ? (
                  <KnowledgeGraph graph={graph} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 animate-pulse min-h-[450px]">
                    <div className="w-16 h-16 rounded-full bg-muted-foreground/20 mb-4 flex items-center justify-center">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
                    </div>
                    <span className="text-muted-foreground font-medium">Initializing knowledge graph...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom row: Live Feed */}
            <LiveFeed feed={feed} />

            {showReport && report && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
                <ReportViewer report={report} onClose={() => setShowReport(false)} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
