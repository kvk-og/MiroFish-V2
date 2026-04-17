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
    case "post": return "bg-blue-500 border-blue-500/20";
    case "reply": return "bg-green-500 border-green-500/20";
    case "like": return "bg-pink-500 border-pink-500/20";
    case "share": return "bg-orange-500 border-orange-500/20";
    default: return "bg-gray-500 border-gray-500/20";
  }
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash % 360)}, 70%, 60%)`;
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
             <div className="space-y-4 p-4 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4">
                     <div className="w-10 h-10 bg-muted-foreground/20 rounded-full" />
                     <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-muted-foreground/20 rounded w-1/4" />
                        <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
                        <div className="h-4 bg-muted-foreground/20 rounded w-1/2" />
                     </div>
                  </div>
                ))}
             </div>
          )}
          {feed.map((item, i) => {
            const isReply = item.target_id && item.action_type === "reply";
            const targetItem = isReply ? feed.find(f => f.id === item.target_id) : null;
            
            return (
              <div key={i} className={`flex items-start gap-4 p-4 rounded-xl border border-transparent bg-muted/40 hover:bg-muted/80 transition-all ${isReply ? 'ml-8 relative' : ''}`}>
                {isReply && (
                  <div className="absolute -left-6 top-6 w-4 h-8 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl-lg" />
                )}
                
                {/* Avatar */}
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0"
                  style={{ backgroundColor: getAvatarColor(item.agent_name) }}
                >
                  {item.agent_name.substring(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                       <span className="font-semibold text-sm">{item.agent_name}</span>
                       <Badge variant="outline" className={`text-[10px] uppercase border px-1.5 py-0 ${actionColor(item.action_type)}`}>{item.action_type}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  
                  {isReply && targetItem && (
                    <div className="mb-2 text-xs text-muted-foreground border-l-2 border-primary/20 pl-2 py-1 bg-background/50 rounded-r-md italic line-clamp-2">
                      Replying to {targetItem.agent_name}: "{targetItem.content}"
                    </div>
                  )}

                  <p className="text-sm text-foreground/90 leading-relaxed font-normal whitespace-pre-wrap">{item.content}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
