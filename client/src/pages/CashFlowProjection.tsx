import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Calendar, DollarSign } from "lucide-react";

export default function CashFlowProjection() {
  const { data, isLoading } = trpc.cashFlowProjection.get12Months.useQuery();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const maxValue = useMemo(() => {
    if (!data?.projections) return 0;
    return Math.max(...data.projections.map(p => p.totalExpected));
  }, [data]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <Skeleton className="h-12 w-96" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Cash Flow Projection</h1>
          <p className="text-muted-foreground mt-2">
            Projeção de recebimentos esperados nos próximos 12 meses
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos 3 Meses</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data?.summary.next3Months || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Recebimento esperado no trimestre
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos 6 Meses</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data?.summary.next6Months || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Recebimento esperado no semestre
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos 12 Meses</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data?.summary.next12Months || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data?.summary.activeContracts} contratos ativos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Projeção Mensal</CardTitle>
            <CardDescription>
              Recebimentos esperados por mês (installments + balloons)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.projections.map((projection) => (
                <div key={projection.monthKey} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{projection.month}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(projection.totalExpected)}
                    </span>
                  </div>
                  <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary transition-all"
                      style={{
                        width: `${maxValue > 0 ? (projection.totalExpected / maxValue) * 100 : 0}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-xs text-primary-foreground font-medium">
                      {projection.contractCount > 0 && `${projection.contractCount} contratos`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Breakdown Detalhado</CardTitle>
            <CardDescription>
              Separação entre parcelas mensais e balloon payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Installments</TableHead>
                  <TableHead className="text-right">Balloons</TableHead>
                  <TableHead className="text-right">Total Esperado</TableHead>
                  <TableHead className="text-right">Contratos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.projections.map((projection) => (
                  <TableRow key={projection.monthKey}>
                    <TableCell className="font-medium">{projection.month}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(projection.expectedInstallments)}
                    </TableCell>
                    <TableCell className="text-right">
                      {projection.expectedBalloons > 0 ? (
                        <span className="font-semibold text-green-600">
                          {formatCurrency(projection.expectedBalloons)}
                        </span>
                      ) : (
                        formatCurrency(0)
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(projection.totalExpected)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {projection.contractCount}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL (12 meses)</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      data?.projections.reduce((sum, p) => sum + p.expectedInstallments, 0) || 0
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      data?.projections.reduce((sum, p) => sum + p.expectedBalloons, 0) || 0
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(data?.summary.next12Months || 0)}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Esta projeção assume que todos os buyers pagarão em dia conforme os termos contratuais. 
              Valores reais podem variar devido a atrasos, pagamentos antecipados ou defaults. 
              Use esta projeção como referência para planejamento financeiro, não como garantia de recebimento.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
