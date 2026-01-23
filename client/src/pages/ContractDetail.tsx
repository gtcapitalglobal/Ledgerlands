import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit, DollarSign, TrendingUp, Calendar, FileText } from "lucide-react";

export default function ContractDetail() {
  const [, params] = useRoute("/contracts/:id");
  const contractId = params?.id ? parseInt(params.id) : 0;
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data, isLoading } = trpc.contracts.getWithCalculations.useQuery({ 
    id: contractId,
    year: selectedYear 
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "PaidOff":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "Default":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "Repossessed":
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const getTypeColor = (type: string) => {
    return type === "DIRECT" 
      ? "bg-primary/10 text-primary hover:bg-primary/10" 
      : "bg-accent/10 text-accent-foreground hover:bg-accent/10";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <Link href="/contracts">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
          </div>
          <Card className="shadow-elegant">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Contrato não encontrado</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { contract, payments, calculations } = data;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Link href="/contracts">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Contrato {contract.propertyId}
            </h1>
            <p className="text-muted-foreground">{contract.buyerName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getTypeColor(contract.originType)} variant="outline">
              {contract.originType}
            </Badge>
            <Badge className={getStatusColor(contract.status)}>
              {contract.status}
            </Badge>
            <Button className="shadow-elegant">
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gross Profit %
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatPercent(calculations.grossProfitPercent)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(calculations.grossProfit)} lucro bruto
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receivable Balance
              </CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(calculations.receivableBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Saldo pendente
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Principal Received ({selectedYear})
              </CardTitle>
              <Calendar className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(calculations.principalReceivedYear)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Ano atual
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gain Recognized ({selectedYear})
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(calculations.gainRecognizedYear)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lucro fiscal reconhecido
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Contract Details */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Detalhes do Contrato</CardTitle>
            <CardDescription>Informações completas do contrato</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Property ID</p>
                  <p className="text-lg font-semibold">{contract.propertyId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Buyer Name</p>
                  <p className="text-lg">{contract.buyerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">County</p>
                  <p className="text-lg">{contract.county}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contract Date</p>
                  <p className="text-lg">{formatDate(contract.contractDate)}</p>
                </div>
                {contract.transferDate && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Transfer Date</p>
                    <p className="text-lg">{formatDate(contract.transferDate)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contract Price</p>
                  <p className="text-lg font-semibold">{formatCurrency(contract.contractPrice)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cost Basis</p>
                  <p className="text-lg">{formatCurrency(contract.costBasis)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Down Payment</p>
                  <p className="text-lg">{formatCurrency(contract.downPayment)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Installment Amount</p>
                  <p className="text-lg">{contract.installmentAmount ? formatCurrency(contract.installmentAmount) : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Installment Count</p>
                  <p className="text-lg">{contract.installmentCount} payments</p>
                </div>
                {contract.balloonAmount && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Balloon Amount</p>
                      <p className="text-lg">{formatCurrency(contract.balloonAmount)}</p>
                    </div>
                    {contract.balloonDate && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Balloon Date</p>
                        <p className="text-lg">{formatDate(contract.balloonDate)}</p>
                      </div>
                    )}
                  </>
                )}
                {contract.openingReceivable && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Opening Receivable (ASSUMED)</p>
                    <p className="text-lg">{formatCurrency(contract.openingReceivable)}</p>
                  </div>
                )}
              </div>
            </div>

            {contract.notes && (
              <>
                <Separator className="my-6" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm">{contract.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="shadow-elegant">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Histórico de Pagamentos</CardTitle>
                <CardDescription>{payments.length} pagamentos registrados</CardDescription>
              </div>
              <Button className="shadow-elegant">
                <FileText className="h-4 w-4 mr-2" />
                Adicionar Pagamento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum pagamento registrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Late Fee</TableHead>
                      <TableHead>Received By</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Memo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {formatDate(payment.paymentDate)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(payment.amountTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(payment.principalAmount)}
                        </TableCell>
                        <TableCell className="text-right text-accent-foreground">
                          {formatCurrency(payment.lateFeeAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.receivedBy}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{payment.channel}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {payment.memo || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
