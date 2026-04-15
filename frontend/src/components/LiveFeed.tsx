import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { FeedItem } from "@/lib/api";

interface LiveFeedProps {
  feed: FeedItem[];
}

function actionColor(type: string): string {
  switch (type) {
    case "post": return "bg-blue-500";
    case "reply": return "bg-green-500";
    case "like": return "bg-pink-500";
    case "share": return "bg-orange-500";
    default: return "bg-gray-500";
  }
}

export function LiveFeed({ feed }: LiveFeedProps) {
  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          Live Feed
          {feed.length > 0 && (
            <Badge variant="secondary">{feed.length} events</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <Separator />
      <ScrollArea className="flex-1">
        <CardContent className="pt-4 space-y-3">
          {feed.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Waiting for simulation to start...
            </p>
          )}
          {feed.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className={`w-2 h-2 mt-2 rounded-full ${actionColor(item.action_type)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{item.agent_name}</span>
                  <Badge variant="outline" className="text-xs">{item.action_type}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground break-words">{item.content}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
