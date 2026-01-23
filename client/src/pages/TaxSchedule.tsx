import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function TaxSchedule() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: schedule, isLoading } = trpc.taxSchedule.getByYear.useQuery({ year: selectedYear });

  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const totals = useMemo(() => {
    if (!schedule) return {
      principalReceived: 0,
      gainRecognized: 0,
      lateFees: 0,
      totalProfitRecognized: 0,
    };

    return schedule.reduce((acc, item) => ({
      principalReceived: acc.principalReceived + item.principalReceived,
      gainRecognized: acc.gainRecognized + item.gainRecognized,
      lateFees: acc.lateFees + item.lateFees,
      totalProfitRecognized: acc.totalProfitRecognized + item.totalProfitRecognized,
    }), {
      principalReceived: 0,
      gainRecognized: 0,
      lateFees: 0,
      totalProfitRecognized: 0,
    });
  }, [schedule]);

  const handleExportCSV = () => {
    if (!schedule || schedule.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      'Property ID',
      'Buyer Name',
      'Type',
      'Principal Received',
      'Gross Profit %',
      'Gain Recognized',
      'Late Fees',
      'Total Profit Recognized'
    ];

    const rows = schedule.map(item => [
      item.propertyId,
      item.buyerName,
      item.type,
      item.principalReceived.toFixed(2),
      item.grossProfitPercent.toFixed(2),
      item.gainRecognized.toFixed(2),
      item.lateFees.toFixed(2),
      item.totalProfitRecognized.toFixed(2),
    ]);

    // Add totals row
    rows.push([
      'TOTAL',
      '',
      '',
      totals.principalReceived.toFixed(2),
      '',
      totals.gainRecognized.toFixed(2),
      totals.lateFees.toFixed(2),
      totals.totalProfitRecognized.toFixed(2),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax_profit_schedule_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Tax schedule for ${selectedYear} exported successfully`);
  };

  const getTypeColor = (type: string) => {
    return type === "DIRECT" 
      ? "bg-primary/10 text-primary hover:bg-primary/10" 
      : "bg-accent/10 text-accent-foreground hover:bg-accent/10";
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Tax Profit Schedule</h1>
            <p className="text-muted-foreground mt-2">
              Schedule fiscal anual de lucro reconhecido por contrato
            </p>
          </div>
          <Button onClick={handleExportCSV} className="shadow-elegant">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Year Selector */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Selecionar Ano Fiscal</CardTitle>
            <CardDescription>Visualize o schedule de lucro reconhecido para o ano selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Principal Received
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totals.principalReceived)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total principal recebido em {selectedYear}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gain Recognized
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(totals.gainRecognized)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lucro reconhecido (installment sale method)
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Late Fees
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(totals.lateFees)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                100% income reconhecido
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Profit Recognized
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(totals.totalProfitRecognized)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Gain + Late Fees
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Schedule Table */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Schedule por Contrato - {selectedYear}</CardTitle>
            <CardDescription>
              Detalhamento do lucro reconhecido para cada contrato conforme Installment Sale Method
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !schedule || schedule.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Nenhum pagamento registrado para {selectedYear}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Buyer Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Principal Received</TableHead>
                      <TableHead className="text-right">Gross Profit %</TableHead>
                      <TableHead className="text-right">Gain Recognized</TableHead>
                      <TableHead className="text-right">Late Fees</TableHead>
                      <TableHead className="text-right">Total Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.map((item) => (
                      <TableRow key={item.contractId} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-primary">
                          {item.propertyId}
                        </TableCell>
                        <TableCell>{item.buyerName}</TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(item.type)}>
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.principalReceived)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(item.grossProfitPercent)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(item.gainRecognized)}
                        </TableCell>
                        <TableCell className="text-right text-accent-foreground font-medium">
                          {formatCurrency(item.lateFees)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(item.totalProfitRecognized)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3} className="text-right">
                        TOTAL
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(totals.principalReceived)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(totals.gainRecognized)}
                      </TableCell>
                      <TableCell className="text-right text-accent-foreground">
                        {formatCurrency(totals.lateFees)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(totals.totalProfitRecognized)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Explanation */}
        <Card className="shadow-elegant bg-muted/30">
          <CardHeader>
            <CardTitle>Installment Sale Method - Explicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <strong>Gross Profit %</strong> = (Contract Price - Cost Basis) / Contract Price
            </p>
            <p>
              <strong>Gain Recognized</strong> = Principal Received × Gross Profit %
            </p>
            <p>
              <strong>Late Fees</strong> são reconhecidos como 100% income no ano recebido
            </p>
            <p className="text-muted-foreground">
              Este schedule é usado para fins fiscais. No Wave (Model 1), o revenue total é reconhecido na data de assinatura do contrato.
              Este dashboard calcula o lucro reconhecido conforme Installment Sale Method para reporting fiscal.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
