import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function PreDeedTieOutButton() {
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [customCutoffDate, setCustomCutoffDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const exportMutation = trpc.reports.preDeedTieOutExport.useMutation();

  const handleGenerate = async (cutoffDate: string, format: "csv" | "pdf") => {
    try {
      setIsGenerating(true);
      
      const result = await exportMutation.mutateAsync({
        cutoffDate,
        format,
      });

      // Download the file
      if (format === "csv") {
        const blob = new Blob([result.content], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // PDF: open HTML in new window and print
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        }
      }
    } catch (error) {
      console.error("Failed to generate report:", error);
      alert("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isGenerating}>
            <FileText className="mr-2 h-4 w-4" />
            Pre-Deed Tie-Out
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleGenerate("2025-12-31", "pdf")}
          >
            <Download className="mr-2 h-4 w-4" />
            Generate Tie-Out (12/31/2025)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleGenerate("2026-12-31", "pdf")}
          >
            <Download className="mr-2 h-4 w-4" />
            Generate Tie-Out (12/31/2026)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsCustomDialogOpen(true)}
          >
            <FileText className="mr-2 h-4 w-4" />
            Custom Cutoff Date...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Pre-Deed Tie-Out</DialogTitle>
            <DialogDescription>
              Select a custom cutoff date to generate the Pre-Deed Tie-Out report
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cutoff-date">Cutoff Date</Label>
              <Input
                id="cutoff-date"
                type="date"
                value={customCutoffDate}
                onChange={(e) => setCustomCutoffDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (customCutoffDate) {
                    handleGenerate(customCutoffDate, "pdf");
                    setIsCustomDialogOpen(false);
                  }
                }}
                disabled={!customCutoffDate || isGenerating}
                className="flex-1"
              >
                Generate PDF
              </Button>
              <Button
                onClick={() => {
                  if (customCutoffDate) {
                    handleGenerate(customCutoffDate, "csv");
                    setIsCustomDialogOpen(false);
                  }
                }}
                disabled={!customCutoffDate || isGenerating}
                variant="outline"
                className="flex-1"
              >
                Generate CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
