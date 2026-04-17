import { SimulationReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface ReportViewerProps {
  report: SimulationReport;
  onClose?: () => void;
}

export function ReportViewer({ report, onClose }: ReportViewerProps) {
  const isGo = report.decision.toUpperCase().includes("GO") && !report.decision.toUpperCase().includes("NO-GO");
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#0a0a0a' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`MiroFish-Report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  
  return (
    <Card className="w-full max-w-4xl mx-auto border-border shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500 max-h-[90vh] flex flex-col">
      <div className="flex-1 overflow-y-auto p-1" ref={reportRef}>
        <CardHeader className="pb-4 relative">
          {onClose && (
              <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10" data-html2canvas-ignore>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
          )}
        <CardTitle className="text-3xl font-bold flex items-center justify-between">
          <span>Simulation Final Report</span>
          <Badge 
            variant="default" 
            className={`text-lg px-4 py-1 rounded-sm ${
                isGo 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-destructive/90 hover:bg-destructive'
              }`}
          >
            {report.decision}
          </Badge>
        </CardTitle>
        <CardDescription className="text-base mt-2">
            Based on the analysis of the agents' activity, world facts, and sentiment.
        </CardDescription>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="pt-6 space-y-6">
        <div>
          <h3 className="text-xl font-semibold mb-3">Executive Summary</h3>
          <p className="text-muted-foreground leading-relaxed">
            {report.summary}
          </p>
        </div>
        
        <div>
          <h3 className="text-xl font-semibold mb-3">Key Takeaways</h3>
          <ul className="space-y-2">
            {report.key_takeaways.map((takeaway, i) => (
              <li key={i} className="flex gap-3 text-muted-foreground">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="leading-relaxed">{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>

        {report.analytics && (
          <div>
            <AnalyticsDashboard analytics={report.analytics} />
          </div>
        )}
      </CardContent>
      </div>
      
      <div className="p-4 border-t bg-muted/20 flex justify-end gap-4 rounded-b-xl" data-html2canvas-ignore>
         <Button variant="outline" onClick={onClose}>Close</Button>
         <Button onClick={handleExport} disabled={exporting}>
           {exporting ? "Generating PDF..." : "Export as PDF"}
         </Button>
      </div>
    </Card>
  );
}
