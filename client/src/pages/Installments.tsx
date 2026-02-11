import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, DollarSign, FileDown, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";


export default function Installments() {
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "">("");
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  
  // Payment form state
  const [paidAmount, setPaidAmount] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedBy, setReceivedBy] = useState<"GT_REAL_BANK" | "LEGACY_G&T" | "PERSONAL" | "UNKNOWN">("GT_REAL_BANK");
  const [channel, setChannel] = useState<"ZELLE" | "ACH" | "CASH" | "CHECK" | "WIRE" | "OTHER">("CHECK");
  const [memo, setMemo] = useState("");

  // Fetch all installments to get unique property IDs for dropdown
  const { data: allInstallments = [] } = trpc.installments.list.useQuery({});
  
  // Get unique property IDs from all installments
  const uniquePropertyIds = useMemo(() => {
    const ids = new Set(allInstallments.map(i => i.propertyId));
    return Array.from(ids).sort();
  }, [allInstallments]);

  // Fetch filtered installments based on user selection
  const { data: installments = [], isLoading, refetch } = trpc.installments.list.useQuery({
    propertyId: propertyFilter && propertyFilter !== 'all' ? propertyFilter : undefined,
    status: statusFilter || undefined,
  });

  // Calculate KPIs from filtered installments
  const kpis = useMemo(() => {
    // Total Installments = only REGULAR installments (exclude DOWN_PAYMENT and BALLOON)
    const regularInstallments = installments.filter(i => i.type === 'REGULAR');
    const totalCount = regularInstallments.length;
    
    // Paid = only REGULAR installments with PAID status
    const paidCount = regularInstallments.filter(i => i.status === 'PAID').length;
    
    // Pending = only REGULAR installments with PENDING/OVERDUE status
    const pendingCount = regularInstallments.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').length;
    
    // Balloon Paid = 0 or 1 (only Property #25 has balloon)
    const balloonPaid = installments.filter(i => i.type === 'BALLOON' && i.status === 'PAID').length;
    
    // Total Paid = DOWN_PAYMENT + REGULAR paid + BALLOON paid (includes everything)
    const totalPaid = installments
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + parseFloat(i.paidAmount || i.amount), 0);
    
    // Balance Due = sum of REGULAR pending installments only
    const totalReceivable = regularInstallments
      .filter(i => i.status === 'PENDING' || i.status === 'OVERDUE')
      .reduce((sum, i) => sum + parseFloat(i.amount), 0);
    
    return { totalCount, balloonPaid, paidCount, pendingCount, totalPaid, totalReceivable };
  }, [installments]);

  const markAsPaidMutation = trpc.installments.markAsPaid.useMutation({
    onSuccess: () => {
      console.log('Parcela marcada como paga');
      setPaymentDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error('Erro ao marcar parcela:', error.message);
    },
  });

  const downloadPDF = (data: { pdf: string; filename: string }) => {
    // Convert base64 to blob and download
    const byteCharacters = atob(data.pdf);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportingPDF(false);
  };

  const exportPDFMutation = trpc.installments.exportStatementPDF.useMutation({
    onSuccess: downloadPDF,
    onError: (error) => {
      console.error('Erro ao exportar PDF:', error.message);
      alert('Erro ao gerar PDF. Por favor, tente novamente.');
      setExportingPDF(false);
    },
  });

  const exportPDFMutation_ES = trpc.installments.exportStatementPDF_ES.useMutation({
    onSuccess: downloadPDF,
    onError: (error) => {
      console.error('Error exporting Spanish PDF:', error);
      alert('Erro ao gerar PDF em espanhol. Por favor, tente novamente.');
      setExportingPDF(false);
    },
  });

  const handleExportPDF = (language: 'EN' | 'ES' = 'EN') => {
    if (!propertyFilter || propertyFilter === 'all') {
      alert('Por favor, selecione uma propriedade específica para exportar o relatório.');
      return;
    }
    
    // Find contract ID for the selected property
    const firstInstallment = installments.find(i => i.propertyId === propertyFilter);
    if (!firstInstallment) {
      alert('Nenhuma parcela encontrada para esta propriedade.');
      return;
    }
    
    setExportingPDF(true);
    const mutation = language === 'ES' ? exportPDFMutation_ES : exportPDFMutation;
    mutation.mutate({
      propertyId: propertyFilter,
      contractId: firstInstallment.contractId,
    });
  };

  const handleMarkAsPaid = (installment: any) => {
    setSelectedInstallment(installment);
    setPaidAmount(installment.amount);
    setPaidDate(new Date().toISOString().split('T')[0]);
    setMemo(`Installment #${installment.installmentNumber}`);
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = () => {
    if (!selectedInstallment) return;

    markAsPaidMutation.mutate({
      installmentId: selectedInstallment.id,
      paidAmount: parseFloat(paidAmount),
      paidDate,
      receivedBy,
      channel,
      memo,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Pago</Badge>;
      case "OVERDUE":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Atrasado</Badge>;
      case "PENDING":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case "PARTIAL":
        return <Badge variant="outline"><DollarSign className="w-3 h-3 mr-1" />Parcial</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "BALLOON":
        return <Badge className="bg-purple-600">Balão</Badge>;
      case "DOWN_PAYMENT":
        return <Badge className="bg-blue-600">Entrada</Badge>;
      default:
        return <Badge variant="outline">Regular</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando parcelas...</p>
        </div>
      </div>
    );
  }

  // Group installments by property
  const groupedInstallments = installments.reduce((acc, inst) => {
    if (!acc[inst.propertyId]) {
      acc[inst.propertyId] = [];
    }
    acc[inst.propertyId].push(inst);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.history.back()}
          className="-ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Parcelas</h1>
          <p className="text-muted-foreground">Gestão de vencimentos e pagamentos mensais</p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Installments</CardDescription>
            <CardTitle className="text-2xl">{kpis.totalCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Balloon Paid</CardDescription>
            <CardTitle className="text-2xl text-purple-600">{kpis.balloonPaid}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paid</CardDescription>
            <CardTitle className="text-2xl text-green-600">{kpis.paidCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl text-orange-600">{kpis.pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Paid</CardDescription>
            <CardTitle className="text-2xl text-green-600">${kpis.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Balance Due</CardDescription>
            <CardTitle className="text-2xl text-blue-600">${kpis.totalReceivable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Filtros</CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={() => handleExportPDF('EN')}
              disabled={!propertyFilter || propertyFilter === 'all' || exportingPDF}
              variant="outline"
              size="sm"
            >
              <FileDown className="w-4 h-4 mr-2" />
              {exportingPDF ? 'Gerando PDF...' : 'Exportar PDF (EN)'}
            </Button>
            <Button
              onClick={() => handleExportPDF('ES')}
              disabled={!propertyFilter || propertyFilter === 'all' || exportingPDF}
              variant="outline"
              size="sm"
            >
              <FileDown className="w-4 h-4 mr-2" />
              {exportingPDF ? 'Gerando PDF...' : 'Exportar PDF (ES)'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Property ID</Label>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniquePropertyIds.map(id => (
                  <SelectItem key={id} value={id}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="OVERDUE">Atrasado</SelectItem>
                <SelectItem value="PAID">Pago</SelectItem>
                <SelectItem value="PARTIAL">Parcial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Installments Table */}
      {Object.keys(groupedInstallments).length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p>Nenhuma parcela encontrada</p>
              <p className="text-sm mt-2">As parcelas são geradas automaticamente ao criar contratos CFD</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedInstallments).map(([propertyId, installs]) => (
          <Card key={propertyId}>
            <CardHeader>
              <CardTitle>Contrato #{propertyId}</CardTitle>
              <CardDescription>{installs.length} parcelas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Pago</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installs.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.installmentNumber}</TableCell>
                      <TableCell>{getTypeBadge(inst.type)}</TableCell>
                      <TableCell>{formatDate(inst.dueDate)}</TableCell>
                      <TableCell>${parseFloat(inst.amount).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(inst.status)}</TableCell>
                      <TableCell>
                        {inst.paidDate ? formatDate(inst.paidDate) : '-'}
                      </TableCell>
                      <TableCell>
                        {inst.status !== 'PAID' && (
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsPaid(inst)}
                          >
                            Marcar como Pago
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Contrato #{selectedInstallment?.propertyId} - Parcela #{selectedInstallment?.installmentNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Valor Pago</Label>
              <Input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>

            <div>
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Recebido Por</Label>
              <Select value={receivedBy} onValueChange={(val: any) => setReceivedBy(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GT_REAL_BANK">GT Real Bank</SelectItem>
                  <SelectItem value="LEGACY_G&T">Legacy G&T</SelectItem>
                  <SelectItem value="PERSONAL">Personal</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Canal</Label>
              <Select value={channel} onValueChange={(val: any) => setChannel(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZELLE">Zelle</SelectItem>
                  <SelectItem value="ACH">ACH</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CHECK">Check</SelectItem>
                  <SelectItem value="WIRE">Wire</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Memo (Opcional)</Label>
              <Input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Notas sobre o pagamento"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitPayment} disabled={markAsPaidMutation.isPending}>
              {markAsPaidMutation.isPending ? "Salvando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
