import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function ContractsSubledger() {
  const [period, setPeriod] = useState<"YEAR" | "Q1" | "Q2" | "Q3" | "Q4" | "RANGE">("YEAR");
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const exportCSVQuery = trpc.contractsSubledger.exportCSV.useQuery(
    { period, year, startDate, endDate },
    { enabled: false }
  );

  const exportExcelQuery = trpc.contractsSubledger.exportExcel.useQuery(
    { period, year, startDate, endDate },
    { enabled: false }
  );

  const handleExportCSV = async () => {
    try {
      const result = await exportCSVQuery.refetch();
      if (result.data) {
        const { rows, filename } = result.data;
        
        const headers = Object.keys(rows[0] || {});
        const csvContent = [
          headers.join(','),
          ...rows.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`Export concluído: ${filename}`);
      }
    } catch (error) {
      toast.error("Erro no export: Não foi possível gerar o arquivo CSV");
    }
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportExcelQuery.refetch();
      if (result.data) {
        const { rows, filename } = result.data;
        
        const headers = Object.keys(rows[0] || {});
        const csvContent = [
          headers.join(','),
          ...rows.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`Export concluído: ${filename}`);
      }
    } catch (error) {
      toast.error("Erro no export: Não foi possível gerar o arquivo Excel");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Contracts Subledger</h1>
          <p className="text-muted-foreground mt-2">
            Relatório operacional e de auditoria para reconciliação com Wave A/R
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Exportar Subledger</CardTitle>
            <CardDescription>
              Selecione o período e formato para exportação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period">Período</Label>
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                  <SelectTrigger id="period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YEAR">Anual</SelectItem>
                    <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
                    <SelectItem value="Q2">Q2 (Abr-Jun)</SelectItem>
                    <SelectItem value="Q3">Q3 (Jul-Set)</SelectItem>
                    <SelectItem value="Q4">Q4 (Out-Dez)</SelectItem>
                    <SelectItem value="RANGE">Período Customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {period !== "RANGE" && (
                <div className="space-y-2">
                  <Label htmlFor="year">Ano</Label>
                  <Input
                    id="year"
                    type="number"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    min={2020}
                    max={2030}
                  />
                </div>
              )}

              {period === "RANGE" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data Início</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Data Fim</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleExportCSV}
                disabled={exportCSVQuery.isFetching}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {exportCSVQuery.isFetching ? "Gerando..." : "Exportar CSV"}
              </Button>

              <Button
                onClick={handleExportExcel}
                disabled={exportExcelQuery.isFetching}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {exportExcelQuery.isFetching ? "Gerando..." : "Exportar Excel"}
              </Button>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <p className="font-medium">Campos incluídos no relatório:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Property ID, Buyer Name, Contract Type (DIRECT/ASSUMED)</li>
                <li>Current Entity, Sale/Contract Date, Transfer Date</li>
                <li>Contract Price, Cost Basis, Down Payment</li>
                <li>Installment Amount, Count, Balloon Amount, Interest Rate</li>
                <li>Total Cash Collected (lifetime), Principal Outstanding</li>
                <li>Opening Receivable (ASSUMED), Contract Status</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diferença entre Subledger e Tax Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Contracts Subledger (esta página):</h3>
              <p className="text-sm text-muted-foreground">
                Relatório operacional para reconciliação contábil com Wave A/R. Mostra situação atual de cada contrato (saldo a receber, cash coletado, status).
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Tax Schedule:</h3>
              <p className="text-sm text-muted-foreground">
                Relatório fiscal para IRS Form 6252. Mostra gain recognized (lucro fiscal) por período, usado exclusivamente para declaração de impostos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
