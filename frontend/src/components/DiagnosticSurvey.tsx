import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { generateSurveyQuestions, type SurveyQuestion, type UserProfile, type BotConfig } from "@/lib/api";

interface DiagnosticSurveyProps {
  onSubmit: (
    scenario: string,
    platform: string,
    maxRounds: number,
    userProfile?: UserProfile,
    numAgents?: number,
    botConfig?: BotConfig
  ) => void;
  loading: boolean;
}

export function DiagnosticSurvey({ onSubmit, loading }: DiagnosticSurveyProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadedContext, setUploadedContext] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const TEMPLATES = [
    { id: "product", name: "Product Launch", desc: "Test a new physical product or software feature launch in the market.", scenario: "We are launching a new high-end AR smart-glasses product priced at $1,200. We want to test the reaction of tech enthusiasts, privacy advocates, and general consumers to see if the pricing and features resonate." },
    { id: "policy", name: "Policy Change", desc: "Simulate public reaction to a new local or national policy.", scenario: "A new residential zoning policy introduced in a major city amidst high housing costs. It aims to build high-density housing in traditionally suburban neighborhoods, facing heavy pushback from current homeowners." },
    { id: "crisis", name: "Brand Crisis", desc: "Navigate a corporate or PR crisis scenario.", scenario: "A popular ride-sharing company has suffered a severe data breach affecting millions. The CEO has issued a brief public apology on social media, but users are criticizing it for lack of transparency and action." },
    { id: "pricing", name: "Price Increase", desc: "Gauge reaction to a controversial pricing update.", scenario: "A beloved subscription software service announces a 25% price increase for its standard tier while simultaneously introducing ads. Users are evaluating whether to cancel, downgrade, or complain." }
  ];

  // Step 1: Scenario
  const [scenario, setScenario] = useState("");
  const [productSummary, setProductSummary] = useState("");

  // Step 2: Dynamic Questions
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  // Step 3: Configuration
  const [numAgents, setNumAgents] = useState(3);
  const [creativity, setCreativity] = useState("Balanced");
  const [strictness, setStrictness] = useState("Neutral");
  const [platform, setPlatform] = useState("twitter");
  const [maxRounds, setMaxRounds] = useState(10);
  const [location, setLocation] = useState("");
  const [devilsAdvocate, setDevilsAdvocate] = useState(false);

  const handleNextStep1 = async () => {
    if (!scenario.trim()) return;
    setFetchingQuestions(true);
    setError(null);
    try {
      const qs = await generateSurveyQuestions(scenario);
      setQuestions(qs);
      setStep(2);
    } catch (e: any) {
      setError("Failed to generate diagnostic questions. Please try a different scenario or check the backend.");
    } finally {
      setFetchingQuestions(false);
    }
  };

  const handleNextStep2 = () => {
    // Optionally ensure all answers are filled, but let's allow progressing anyway
    setStep(3);
  };

  const handleSubmit = () => {
    if (!scenario.trim()) return;

    // Collate survey answers into the `survey_motivation` field or social_factors
    const surveyText = questions.map(q => `Q: ${q.question}\nA: ${answers[q.id]?.join(", ") || "Skipped"}`).join("\n");

    const userProfile: UserProfile = {
      location: location || undefined,
      survey_motivation: surveyText,
      // Injecting the raw Q&A into social factors for the LLM prompt to see if not parsed natively
      social_factors: "Survey Responses:\n" + surveyText,
    };

    const botConfig: BotConfig = {
      creativity,
      strictness,
      devils_advocate: devilsAdvocate
    };

    let finalScenario = scenario;
    if (productSummary) {
      finalScenario += `\n\n[PRODUCT SUMMARY & NATURE OF DEBATE]\n${productSummary}`;
    }
    if (uploadedContext) {
      finalScenario += `\n\n[SUPPORTING DOCUMENT CONTENT]\n${uploadedContext}`;
    }

    onSubmit(finalScenario, platform, maxRounds, userProfile, numAgents, botConfig);
  };

  return (
    <Card className="w-full max-w-2xl bg-card border-border shadow-lg backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">Perspective Simulation Setup</CardTitle>
        <div className="flex gap-2 items-center mt-2">
          <div className={`h-2 flex-1 rounded ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 flex-1 rounded ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-2 flex-1 rounded ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive text-destructive text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <Label className="text-base font-medium">What scenario do you want to explore?</Label>
              <CardDescription className="mb-4 mt-1">
                Describe the social scenario, policy decision, or product launch. The AI will generate a tailored diagnostic survey to understand your exact motivation.
              </CardDescription>
              <Textarea
                placeholder="e.g. A new residential zoning policy introduced in San Francisco amidst high housing costs..."
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                rows={5}
                className="resize-none bg-background focus:ring-1 focus:ring-ring"
              />
              <div className="flex justify-between mt-2 mb-4">
                <span className={`text-xs ${scenario.length > 0 && scenario.length < 50 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  {scenario.length > 0 && scenario.length < 50 ? 'Please provide at least 50 characters for better context.' : ''}
                </span>
                <span className="text-xs text-muted-foreground">{scenario.length} characters</span>
              </div>
              
              <div className="mt-6 mb-2">
                <Label className="text-base font-medium">Product Summary & Nature of Debate</Label>
                <CardDescription className="mb-4 mt-1">
                  Ensure the bots truly understand your product. Explain the specific features, the target audience, and the exact nature of the debate or challenge you want to simulate.
                </CardDescription>
                <Textarea
                  placeholder="e.g. The product is a $1,200 AR headset targeting tech enthusiasts. The debate is about privacy concerns vs technological progression."
                  value={productSummary}
                  onChange={(e) => setProductSummary(e.target.value)}
                  rows={4}
                  className="resize-none bg-background focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="mt-4 mb-2 p-4 border border-dashed border-border rounded-lg bg-muted/10">
                <Label className="text-sm font-medium mb-1 block">Attach Supporting Document (Optional)</Label>
                <div className="text-xs text-muted-foreground mb-3">Upload a PDF or TXT file (e.g. product specs, research report) to deeply ground the agents' knowledge. Max 5000 words.</div>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    accept=".pdf,.txt"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const { uploadContextDocument } = await import('@/lib/api');
                        const result = await uploadContextDocument(file);
                        setUploadedContext(result.extracted_text);
                        alert(`Successfully processed document: ${file.name}`);
                      } catch (err) {
                        console.error(err);
                        alert("Failed to read document.");
                      } finally {
                        setUploading(false);
                      }
                    }}
                    className="text-sm file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground file:border-0 file:rounded-md file:px-3 file:py-1 hover:file:bg-primary/90 file:cursor-pointer w-full text-muted-foreground"
                    disabled={uploading}
                  />
                  {uploading && <span className="text-xs text-blue-500 animate-pulse whitespace-nowrap">Parsing document...</span>}
                  {uploadedContext && !uploading && <span className="text-xs text-green-500 whitespace-nowrap align-middle"><svg className="inline w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>Context Loaded</span>}
                </div>
              </div>
              
              <div className="mt-6 mb-2">
                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Quick Templates</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {TEMPLATES.map(tpl => (
                    <div 
                      key={tpl.id} 
                      onClick={() => setScenario(tpl.scenario)}
                      className="border border-border/50 bg-muted/20 p-3 rounded-lg cursor-pointer hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="font-semibold text-sm">{tpl.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{tpl.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Button
              onClick={handleNextStep1}
              disabled={fetchingQuestions || scenario.trim().length < 50}
              className="w-full transition-all hover:scale-[1.02] mt-4"
              size="lg"
            >
              {fetchingQuestions ? "Generating Diagnostic Survey..." : "Continue"}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardDescription>
              Please answer these dynamically generated questions to help ground the simulation and the bots to your exact needs.
            </CardDescription>
            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
              {questions.map((q) => (
                <div key={q.id} className="space-y-3">
                  <Label className="text-base font-medium">{q.question}</Label>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, i) => (
                      <label key={i} className="flex items-center space-x-3 border border-border/50 p-3 rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          checked={answers[q.id]?.includes(opt) || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAnswers(prev => {
                              const current = prev[q.id] || [];
                              if (checked) {
                                return { ...prev, [q.id]: [...current, opt] };
                              } else {
                                return { ...prev, [q.id]: current.filter(x => x !== opt) };
                              }
                            });
                          }}
                          className="w-4 h-4 rounded border-primary text-primary focus:ring-primary accent-primary"
                        />
                        <span className="flex-1 font-normal text-sm leading-none">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={handleNextStep2} className="flex-1 transition-all hover:scale-[1.02]">Next: Bot Configuration</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardDescription>
              Configure the simulation parameters and the demographic rules for your bots.
            </CardDescription>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Bots Count */}
              <div>
                <Label className="mb-2 block">Number of Bots</Label>
                <Select value={String(numAgents)} onValueChange={(v) => setNumAgents(Number(v))}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 3, 5, 10, 15, 20].map(n => <SelectItem key={n} value={String(n)}>{n} Bots</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

               {/* Location Context */}
               <div>
                <Label className="mb-2 block">Location / Demographic Anchor</Label>
                <Input
                  placeholder="e.g. London, UK (Optional)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="bg-background"
                />
              </div>

              {/* Strictness */}
              <div>
                <Label className="mb-2 block">Bot Critcality / Safety</Label>
                <Select value={strictness} onValueChange={(val) => { if (val) setStrictness(val); }}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Safety-Conscious / Restrained">Safety-Conscious / Restrained</SelectItem>
                    <SelectItem value="Neutral">Neutral</SelectItem>
                    <SelectItem value="Highly Critical / Skeptical">Highly Critical / Skeptical</SelectItem>
                    <SelectItem value="Arrogant / Aggressive">Arrogant / Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Creativity */}
              <div>
                <Label className="mb-2 block">Bot Creativity</Label>
                <Select value={creativity} onValueChange={(val) => { if (val) setCreativity(val); }}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Strictly Data-Driven / Literal">Strictly Data-Driven / Literal</SelectItem>
                    <SelectItem value="Balanced">Balanced</SelectItem>
                    <SelectItem value="Creative / Unpredictable">Creative / Unpredictable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Platform */}
              <div>
                <Label className="mb-2 block">Platform Dynamics</Label>
                <Select value={platform} onValueChange={(val) => { if (val) setPlatform(val); }}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twitter">X (Twitter)</SelectItem>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="hackernews">Hacker News</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rounds */}
              <div>
                <Label className="mb-2 block">Simulation Rounds</Label>
                <Select value={String(maxRounds)} onValueChange={(v) => setMaxRounds(Number(v))}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Rounds</SelectItem>
                    <SelectItem value="10">10 Rounds</SelectItem>
                    <SelectItem value="20">20 Rounds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Devil's Advocate */}
              <div className="col-span-2 mt-2">
                <label className="flex items-center space-x-3 cursor-pointer p-3 border border-red-500/30 bg-red-500/5 rounded-md hover:bg-red-500/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={devilsAdvocate}
                    onChange={(e) => setDevilsAdvocate(e.target.checked)}
                    className="w-4 h-4 text-red-500"
                  />
                  <div>
                    <span className="font-semibold block text-red-500/90 tracking-wide text-sm">Enable Anti-Persona / Devil's Advocate</span>
                    <span className="text-xs text-muted-foreground">Guarantee one agent will be highly critical, contrarian, and ideologically opposed to the main premise.</span>
                  </div>
                </label>
              </div>
            </div>

            <Separator />
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={loading}>Back</Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-[2] transition-all hover:scale-[1.02]"
                size="lg"
              >
                {loading ? "Initializing World & Spawning Bots..." : "Launch Simulation"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
