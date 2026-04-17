import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { UserProfile } from "@/lib/api";

interface CreateSimFormProps {
  onSubmit: (
    scenario: string,
    platform: string,
    maxRounds: number,
    userProfile?: UserProfile,
  ) => void;
  loading: boolean;
}

export function CreateSimForm({ onSubmit, loading }: CreateSimFormProps) {
  const [scenario, setScenario] = useState("");
  const [platform, setPlatform] = useState("twitter");
  const [maxRounds, setMaxRounds] = useState(10);

  // Social context fields
  const [socialOpen, setSocialOpen] = useState(false);
  const [location, setLocation] = useState("");
  const [age, setAge] = useState("");
  const [occupation, setOccupation] = useState("");
  const [handles, setHandles] = useState("");
  const [socialFactors, setSocialFactors] = useState("");

  const handleSubmit = () => {
    if (!scenario.trim()) return;

    // Build user profile if any social context field is filled
    const hasContext = location || age || occupation || handles || socialFactors;
    const userProfile: UserProfile | undefined = hasContext
      ? {
          location: location || undefined,
          age: age ? Number(age) : undefined,
          occupation: occupation || undefined,
          social_handles: handles
            ? handles
                .split(",")
                .map((h) => h.trim())
                .filter(Boolean)
            : undefined,
          social_factors: socialFactors || undefined,
        }
      : undefined;

    onSubmit(scenario, platform, maxRounds, userProfile);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create Simulation</CardTitle>
        <CardDescription>
          Describe a social scenario. The AI will generate agents and simulate their interactions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scenario */}
        <div>
          <Textarea
            placeholder="e.g. A high-stakes tech conference in London where two rival startups are competing for investor attention..."
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <div className="flex justify-between mt-2">
            <span className={`text-xs ${scenario.length > 0 && scenario.length < 50 ? 'text-orange-500' : 'text-muted-foreground'}`}>
              {scenario.length > 0 && scenario.length < 50 ? 'Please provide at least 50 characters for better context.' : ''}
            </span>
            <span className="text-xs text-muted-foreground">{scenario.length} characters</span>
          </div>
        </div>

        {/* Platform & Rounds */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Platform</label>
            <Select value={platform} onValueChange={(v) => v !== null && setPlatform(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="reddit">Reddit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Rounds</label>
            <Select value={String(maxRounds)} onValueChange={(v) => setMaxRounds(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Social Context (Optional) */}
        <Collapsible open={socialOpen} onOpenChange={setSocialOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-semibold">Social Context</span>
              <span className="text-xs text-muted-foreground">(Optional)</span>
            </div>
            <span className="text-muted-foreground text-lg transition-transform duration-200 group-data-[state=open]:rotate-180">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-xs text-muted-foreground mt-2 mb-3">
              Ground the simulation in your real-world social context. The AI will derive
              socio-economic dynamics that shape agent behavior and outcomes.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Location / Town
                  </label>
                  <Input
                    placeholder="e.g. San Francisco, CA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Age</label>
                  <Input
                    type="number"
                    placeholder="e.g. 28"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min={1}
                    max={120}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Occupation
                </label>
                <Input
                  placeholder="e.g. Software Engineer"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Social Media Handles
                </label>
                <Input
                  placeholder="e.g. @user1, @user2, @user3"
                  value={handles}
                  onChange={(e) => setHandles(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Additional Social Factors
                </label>
                <Textarea
                  placeholder="Education level, income bracket, cultural background, political leanings, etc."
                  value={socialFactors}
                  onChange={(e) => setSocialFactors(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <Button
          onClick={handleSubmit}
          disabled={loading || scenario.trim().length < 50}
          className="w-full"
          size="lg"
        >
          {loading ? "Generating World..." : "Launch Simulation"}
        </Button>
      </CardContent>
    </Card>
  );
}
