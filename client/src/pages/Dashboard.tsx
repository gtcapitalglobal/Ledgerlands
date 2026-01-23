import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, FileText, TrendingUp, Wallet, Calendar, AlertCircle } from "lucide-react";

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCounty, setSelectedCounty] = useState<string>("all");

  // Fetch contracts to get unique counties
  const { data: contracts } = trpc.contracts.list.useQuery();
  
  // Build filter object
  const filters = useMemo(() => {
    const f: any = { year: selectedYear };
    if (selectedStatus !== "all") f.status = selectedStatus;
    if (selectedType !== "all") f.type = selectedType;
    if (selectedCounty !== "all") f.county = selectedCounty;
    return f;
  }, [selectedYear, selectedStatus, selectedType, selectedCounty]);

  const { data: kpis, isLoading } = trpc.dashboard.getKPIs.useQuery(filters);

  // Get unique counties
  const uniqueCounties = useMemo(() => {
    if (!contracts) return [];
    const counties = new Set(contracts.map(c => c.county));
    return Array.from(counties).sort();
  }, [contracts]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Visão geral dos contratos de financiamento imobiliário e performance fiscal
          </p>
        </div>

        {/* Filters */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Refine a visualização dos dados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ano</label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="PaidOff">Paid Off</SelectItem>
                    <SelectItem value="Default">Default</SelectItem>
                    <SelectItem value="Repossessed">Repossessed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="DIRECT">DIRECT</SelectItem>
                    <SelectItem value="ASSUMED">ASSUMED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">County</label>
                <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueCounties.map(county => (
                      <SelectItem key={county} value={county}>
                        {county}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : kpis ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Active Contracts */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Contratos Ativos
                </CardTitle>
                <FileText className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpis.activeContracts}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Contratos em andamento
                </p>
              </CardContent>
            </Card>

            {/* Total Contract Price */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Preço Total de Contratos
                </CardTitle>
                <DollarSign className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(kpis.totalContractPrice)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor total dos contratos
                </p>
              </CardContent>
            </Card>

            {/* Total Cost Basis */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Custo Base Total
                </CardTitle>
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(kpis.totalCostBasis)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Investimento total
                </p>
              </CardContent>
            </Card>

            {/* Total Gross Profit */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Lucro Bruto Total
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(kpis.totalGrossProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPercent((kpis.totalGrossProfit / kpis.totalContractPrice) * 100)} margem
                </p>
              </CardContent>
            </Card>

            {/* Total Receivable Balance */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Saldo a Receber
                </CardTitle>
                <Wallet className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(kpis.totalReceivableBalance)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total pendente de recebimento
                </p>
              </CardContent>
            </Card>

            {/* Principal Received YTD */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Principal Recebido YTD
                </CardTitle>
                <Calendar className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(kpis.principalReceivedYTD)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ano {kpis.currentYear}
                </p>
              </CardContent>
            </Card>

            {/* Gain Recognized YTD */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ganho Reconhecido YTD
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(kpis.gainRecognizedYTD)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lucro fiscal reconhecido
                </p>
              </CardContent>
            </Card>

            {/* Late Fees YTD */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Late Fees YTD
                </CardTitle>
                <DollarSign className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(kpis.lateFeesYTD)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  100% income reconhecido
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
