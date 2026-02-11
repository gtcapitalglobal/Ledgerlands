import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, FileText, TrendingUp, Wallet, Calendar, AlertCircle, Download, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from "@/components/ui/button";
import { PreDeedTieOutButton } from "@/components/PreDeedTieOutButton";
import { toast } from "sonner";

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [reportingMode, setReportingMode] = useState<"BOOK" | "TAX">("TAX");
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);

  // Fetch contracts to get unique counties
  const { data: contracts } = trpc.contracts.list.useQuery();
  
  // Backup query (enabled:false, trigger manually)
  const { refetch: refetchBackup } = trpc.backup.downloadAll.useQuery(undefined, { enabled: false });
  
  // Build filter object
  const filters = useMemo(() => {
    const f: any = { year: selectedYear, reportingMode };
    if (selectedStatus !== "all") f.status = selectedStatus;
    if (selectedType !== "all") f.originType = selectedType;
    if (selectedCounty !== "all") f.county = selectedCounty;
    if (selectedPropertyId !== "all") f.propertyId = selectedPropertyId;
    return f;
  }, [selectedYear, selectedStatus, selectedType, selectedCounty, selectedPropertyId, reportingMode]);

  const { data: kpis, isLoading } = trpc.dashboard.getKPIs.useQuery(filters);
  const { data: cashFlowData } = trpc.cashFlowProjection.get12Months.useQuery();
  const { data: overdueCount = 0 } = trpc.installments.getOverdueCount.useQuery();
  
  // Fetch profit by year data
  const profitFilters = useMemo(() => {
    const f: any = { reportingMode };
    if (selectedStatus !== "all") f.status = selectedStatus;
    if (selectedType !== "all") f.originType = selectedType;
    if (selectedCounty !== "all") f.county = selectedCounty;
    if (selectedPropertyId !== "all") f.propertyId = selectedPropertyId;
    return f;
  }, [selectedStatus, selectedType, selectedCounty, selectedPropertyId, reportingMode]);
  
  const { data: profitByYear } = trpc.dashboard.getProfitByYear.useQuery(profitFilters);

  // Get unique counties and property IDs
  const uniqueCounties = useMemo(() => {
    if (!contracts) return [];
    const counties = new Set(contracts.map(c => c.county).filter(Boolean));
    return Array.from(counties).sort();
  }, [contracts]);

  const uniquePropertyIds = useMemo(() => {
    if (!contracts) return [];
    const ids = new Set(contracts.map(c => c.propertyId).filter(Boolean));
    return Array.from(ids).sort();
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
  const [, setLocation] = useLocation();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Visão geral dos contratos de financiamento imobiliário e performance fiscal
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              v93996e7f
            </p>
          </div>
          <div className="flex gap-2">
            <PreDeedTieOutButton />
            <Button 
              onClick={async () => {
              try {
                setIsDownloadingBackup(true);
                toast.info('Gerando backup...');
                
                const { data: backupData } = await refetchBackup();
                
                // Validate backup data exists
                if (!backupData) {
                  toast.error('No backup data');
                  return;
                }
                
                // Create a combined JSON file
                const fullBackup = JSON.stringify(backupData, null, 2);
                const blob = new Blob([fullBackup], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                toast.success(`Backup completo gerado! ${backupData.contracts.length} contratos, ${backupData.payments.length} pagamentos`);
              } catch (error) {
                toast.error('Erro ao gerar backup');
                console.error(error);
              } finally {
                setIsDownloadingBackup(false);
              }
            }}
            disabled={isDownloadingBackup}
            className="shadow-elegant"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Backup
          </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-r from-[#2C5F4F]/5 to-[#B8935E]/5 rounded-lg border border-[#2C5F4F]/20 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#2C5F4F] uppercase tracking-wide">Modo</label>
              <Select value={reportingMode} onValueChange={(v: "BOOK" | "TAX") => setReportingMode(v)}>
                <SelectTrigger className="h-9 border-[#2C5F4F]/30 focus:border-[#B8935E] focus:ring-[#B8935E]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAX">TAX</SelectItem>
                  <SelectItem value="BOOK">BOOK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#2C5F4F] uppercase tracking-wide">Ano</label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="h-9 border-[#2C5F4F]/30 focus:border-[#B8935E] focus:ring-[#B8935E]/20">
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

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#2C5F4F] uppercase tracking-wide">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 border-[#2C5F4F]/30 focus:border-[#B8935E] focus:ring-[#B8935E]/20">
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

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#2C5F4F] uppercase tracking-wide">Tipo</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="h-9 border-[#2C5F4F]/30 focus:border-[#B8935E] focus:ring-[#B8935E]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="DIRECT">DIRECT</SelectItem>
                  <SelectItem value="ASSUMED">ASSUMED</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#2C5F4F] uppercase tracking-wide">County</label>
              <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                <SelectTrigger className="h-9 border-[#2C5F4F]/30 focus:border-[#B8935E] focus:ring-[#B8935E]/20">
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

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#2C5F4F] uppercase tracking-wide">Property</label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger className="h-9 border-[#2C5F4F]/30 focus:border-[#B8935E] focus:ring-[#B8935E]/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniquePropertyIds.map(propId => (
                    <SelectItem key={propId} value={propId}>
                      {propId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

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
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer" onClick={() => setLocation('/contracts?status=Active')}>
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
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer" onClick={() => setLocation('/contracts')}>
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
                  {kpis.totalContractPrice > 0 ? formatPercent((kpis.totalGrossProfit / kpis.totalContractPrice) * 100) : '0.00%'} margem
                </p>
              </CardContent>
            </Card>

            {/* Portfolio ROI */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow border-2 border-green-500/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  ROI do Portfolio
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {kpis.portfolioROI !== undefined ? `${kpis.portfolioROI.toFixed(2)}%` : 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Retorno sobre investimento total
                </p>
              </CardContent>
            </Card>

            {/* Total Receivable Balance */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer" onClick={() => setLocation('/contracts')}>
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
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer" onClick={() => setLocation('/payments')}>
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
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer" onClick={() => setLocation('/tax-schedule')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {reportingMode === "TAX" ? "Ganho Reconhecido YTD" : "Receita de Contrato Aberta YTD"}
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(reportingMode === "TAX" ? kpis.gainRecognizedYTD : kpis.contractRevenueOpened)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {reportingMode === "TAX" ? "Lucro fiscal reconhecido" : "Revenue recognized at execution (Model 1)"}
                </p>
              </CardContent>
            </Card>
            {/* Late Fees YTD */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer" onClick={() => setLocation('/payments')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Late Fees YTD
                </CardTitle>
                <DollarSign className="h-5 w-5 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(kpis.lateFeesYTD)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  100% income no ano {kpis.currentYear}
                </p>
              </CardContent>
            </Card>

            {/* Total Profit Recognized YTD */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer border-2 border-green-500/20" onClick={() => setLocation('/tax-schedule')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Profit Recognized YTD
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(kpis.gainRecognizedYTD + kpis.lateFeesYTD)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Gain + Late Fees {kpis.currentYear}
                </p>
              </CardContent>
            </Card>

            {/* Overdue Installments */}
            <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer border-2 border-red-500/20" onClick={() => setLocation('/installments?status=OVERDUE')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Parcelas Atrasadas
                </CardTitle>
                <AlertCircle className="h-5 w-5 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{overdueCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Vencimentos não pagos
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Profit by Year Chart */}
        {profitByYear && profitByYear.length > 0 && (
          <Card className="shadow-elegant col-span-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Profit by Year ({reportingMode} Mode)
              </CardTitle>
              <CardDescription>
                {reportingMode === 'TAX' ? 'Installment method (gain recognized + late fees)' : 'Contract revenue opened in year'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={profitByYear}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="gainRecognized" fill="#10b981" name="Gain Recognized" />
                  <Bar dataKey="lateFees" fill="#f59e0b" name="Late Fees" />
                </BarChart>
              </ResponsiveContainer>
              
              {/* Selected Year Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {(() => {
                  const selectedYearData = profitByYear.find(p => p.year === selectedYear);
                  if (!selectedYearData) return null;
                  
                  return (
                    <>
                      <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Profit ({selectedYear})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(selectedYearData.totalProfit)}
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Gain Recognized ({selectedYear})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {formatCurrency(selectedYearData.gainRecognized)}
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="shadow-sm">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Late Fees ({selectedYear})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-amber-600">
                            {formatCurrency(selectedYearData.lateFees)}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cash Flow Projection Card */}
        {cashFlowData && (
          <Card className="shadow-elegant">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Projeção de Cash Flow
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Recebimentos esperados nos próximos 3 meses
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setLocation('/cash-flow')}>
                  Ver Detalhes
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cashFlowData.projections.slice(0, 3).map((projection) => (
                  <div key={projection.monthKey} className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      {projection.month}
                    </div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(projection.totalExpected)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {projection.contractCount} contratos
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total (3 meses):</span>
                  <span className="text-lg font-bold">
                    {formatCurrency(cashFlowData.summary.next3Months)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
