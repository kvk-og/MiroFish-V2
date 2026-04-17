import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { SimStatus, Agent } from "@/lib/api";

interface SimControlsProps {
  status: SimStatus | null;
  agents: Agent[];
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onViewReport?: () => void;
  loading: boolean;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "running": return "default";
    case "paused": return "secondary";
    case "completed": return "outline";
    case "failed": return "destructive";
    default: return "secondary";
  }
}

export function SimControls({ status, agents, onStart, onPause, onResume, onStop, onViewReport, loading }: SimControlsProps) {
  if (!status) return null;

  const progress = status.max_rounds > 0 ? (status.current_round / status.max_rounds) * 100 : 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Simulation Control</span>
          <Badge variant={statusVariant(status.status)}>{status.status}</Badge>
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Round {status.current_round} / {status.max_rounds}</span>
            <span className="text-muted-foreground">{status.agents} agents</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="flex gap-2">
          {status.status === "created" && (
            <Button onClick={onStart} disabled={loading} className="flex-1">Start</Button>
          )}
          {status.status === "running" && (
            <Button onClick={onPause} disabled={loading} variant="secondary" className="flex-1">Pause</Button>
          )}
          {status.status === "paused" && (
            <Button onClick={onResume} disabled={loading} className="flex-1">Resume</Button>
          )}
          {["running", "paused"].includes(status.status) && (
            <Button onClick={onStop} disabled={loading} variant="destructive">Stop</Button>
          )}
        </div>
        
        {["completed", "stopped"].includes(status.status) && onViewReport && (
            <Button onClick={onViewReport} disabled={loading} className="w-full mt-2" variant="default">
                Generate Final Report
            </Button>
        )}

        <div>
          <p className="text-sm font-medium mb-2">Agents</p>
          <div className="space-y-1">
            {agents.map((a) => (
              <div key={a.id} className="text-sm text-muted-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium text-foreground">{a.name}</span>
                <span className="truncate">{a.bio}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
