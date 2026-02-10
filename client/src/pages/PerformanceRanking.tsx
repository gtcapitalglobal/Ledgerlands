import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useLocation } from "wouter";

export default function PerformanceRanking() {
  const [, setLocation] = useLocation();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCounty, setSelectedCounty] = useState<string>("all");
  const [selectedOriginType, setSelectedOriginType] = useState<string>("all");

  const { data: performanceData, isLoading } = trpc.contracts.getPerformanceRanking.useQuery({
    status: selectedStatus as any,
    county: selectedCounty === "all" ? undefined : selectedCounty,
    originType: selectedOriginType as any,
  });

  const { data: allContracts } = trpc.contracts.list.useQuery();

  // Get unique counties for filter
  const uniqueCounties = allContracts
    ? Array.from(new Set(allContracts.map(c => c.county).filter(Boolean))).sort()
    : [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Prepare chart data (top 10 contracts by ROI)
  const chartData = performanceData?.slice(0, 10).map(item => ({
    propertyId: item.propertyId,
    roi: item.roi,
  })) || [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Performance Ranking</h1>
        <p className="text-muted-foreground">Contratos ordenados por ROI (melhores investimentos primeiro)</p>
      </div>

      {/* Filters */}
      <Card className="shadow-elegant">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
                <p className="text-xs text-muted-foreground">Refine a visualização dos dados</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">County</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <Select value={selectedOriginType} onValueChange={setSelectedOriginType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="DIRECT">Direct</SelectItem>
                    <SelectItem value="ASSUMED">Assumed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ROI Chart */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Top 10 Contratos por ROI</CardTitle>
          <CardDescription>Comparação visual dos melhores investimentos</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="propertyId" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                <Bar dataKey="roi" fill="#10b981" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.roi > 50 ? "#10b981" : entry.roi > 25 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <p className="text-muted-foreground">Nenhum contrato encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Table */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Ranking Completo</CardTitle>
          <CardDescription>Todos os contratos ordenados por performance</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando...</div>
          ) : performanceData && performanceData.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Property ID</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Contract Price</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Gain Recognized</TableHead>
                    <TableHead className="text-right">Receivable Balance</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="text-right">IRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setLocation(`/contracts?id=${item.id}`)}
                    >
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.propertyId}</TableCell>
                      <TableCell>{item.buyerName}</TableCell>
                      <TableCell>{item.county}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            item.status === "Active"
                              ? "bg-green-50 text-green-700"
                              : item.status === "PaidOff"
                              ? "bg-blue-50 text-blue-700"
                              : item.status === "Default"
                              ? "bg-red-50 text-red-700"
                              : "bg-gray-50 text-gray-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.contractPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.grossProfit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.gainRecognized)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.receivableBalance)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.roi > 50 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : item.roi > 25 ? (
                            <DollarSign className="h-4 w-4 text-amber-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={item.roi > 50 ? "text-green-600 font-semibold" : item.roi > 25 ? "text-amber-600" : "text-red-600"}>
                            {formatPercent(item.roi)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.irr !== null ? formatPercent(item.irr) : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum contrato encontrado com os filtros selecionados
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
