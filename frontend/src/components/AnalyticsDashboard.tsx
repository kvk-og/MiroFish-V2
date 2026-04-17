import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { SimulationReport } from "@/lib/api";

const PIE_COLORS = {
  pro: "#22c55e",
  anti: "#ef4444",
  neutral: "#6b7280"
};

export function AnalyticsDashboard({ analytics }: { analytics: NonNullable<SimulationReport['analytics']> }) {
  const pieData = [
    { name: "Pro", value: analytics.opinion_distribution.pro, color: PIE_COLORS.pro },
    { name: "Anti", value: analytics.opinion_distribution.anti, color: PIE_COLORS.anti },
    { name: "Neutral", value: analytics.opinion_distribution.neutral, color: PIE_COLORS.neutral },
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      <Card className="bg-muted/10 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Sentiment Trend Over Time</CardTitle>
          <CardDescription>Aggregate simulation sentiment per round (0-100 scale)</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.sentiment_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="round" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.2)' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="score" stroke="#3b82f6" fillOpacity={1} fill="url(#colorScore)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-muted/10 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Final Opinion Distribution</CardTitle>
          <CardDescription>Breakdown of agent stances at end of simulation</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.2)' }} 
                itemStyle={{ color: '#fff' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {analytics.opinion_shifts.length > 0 && (
        <Card className="md:col-span-2 bg-muted/10 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Key Opinion Shifts</CardTitle>
            <CardDescription>Major stance changes detected during the simulation</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {analytics.opinion_shifts.map((shift, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-start gap-4 p-4 rounded-lg bg-background/50 border border-border">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-24">
                    <span className="font-semibold text-center">{shift.agent}</span>
                    <div className="flex items-center gap-1 text-xs mt-1">
                       <span className={shift.from === 'anti' ? 'text-red-500' : shift.from === 'pro' ? 'text-green-500' : 'text-gray-500'}>{shift.from}</span>
                       <span className="text-muted-foreground">→</span>
                       <span className={shift.to === 'anti' ? 'text-red-500' : shift.to === 'pro' ? 'text-green-500' : 'text-gray-500'}>{shift.to}</span>
                    </div>
                  </div>
                  <div className="flex-1 text-sm text-foreground/80 leading-relaxed border-l border-border pl-4">
                    {shift.reason}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
