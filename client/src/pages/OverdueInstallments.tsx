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
import { AlertCircle, DollarSign } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

export default function OverdueInstallments() {
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  
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

  // Fetch only OVERDUE installments
  const { data: overdueInstallments = [], isLoading, refetch } = trpc.installments.list.useQuery({
    propertyId: propertyFilter && propertyFilter !== 'all' ? propertyFilter : undefined,
    status: 'OVERDUE',
  });

  // Calculate KPIs from overdue installments
  const kpis = useMemo(() => {
    const totalCount = overdueInstallments.length;
    const totalOverdueAmount = overdueInstallments.reduce((sum, i) => sum + parseFloat(i.amount), 0);
    
    // Group by property
    const propertiesWithOverdue = new Set(overdueInstallments.map(i => i.propertyId)).size;
    
    return { totalCount, totalOverdueAmount, propertiesWithOverdue };
  }, [overdueInstallments]);

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

  // Group installments by property
  const installmentsByProperty = useMemo(() => {
    const grouped = new Map<string, typeof overdueInstallments>();
    overdueInstallments.forEach(inst => {
      if (!grouped.has(inst.propertyId)) {
        grouped.set(inst.propertyId, []);
      }
      grouped.get(inst.propertyId)!.push(inst);
    });
    return grouped;
  }, [overdueInstallments]);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando parcelas atrasadas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parcelas Atrasadas</h1>
        <p className="text-muted-foreground">Gestão de parcelas vencidas e em atraso</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Atrasadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{kpis.totalCount}</div>
            <p className="text-xs text-muted-foreground">Parcelas vencidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total em Atraso</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${kpis.totalOverdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Total pendente de recebimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propriedades Afetadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.propertiesWithOverdue}</div>
            <p className="text-xs text-muted-foreground">Com parcelas atrasadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="property-filter">Property ID</Label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger id="property-filter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniquePropertyIds.map((id) => (
                    <SelectItem key={id} value={id}>
                      Property #{id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Installments List */}
      {overdueInstallments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma parcela atrasada</p>
            <p className="text-sm text-muted-foreground">Todas as parcelas estão em dia! 🎉</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(installmentsByProperty.entries()).map(([propertyId, installments]) => {
            return (
              <Card key={propertyId}>
                <CardHeader>
                  <CardTitle>Property #{propertyId}</CardTitle>
                  <CardDescription>{installments.length} parcelas atrasadas</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Dias em Atraso</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installments.map((installment) => {
                        const daysOverdue = Math.floor(
                          (new Date().getTime() - new Date(installment.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <TableRow key={installment.id}>
                            <TableCell className="font-medium">{installment.installmentNumber}</TableCell>
                            <TableCell>
                              <Badge variant={installment.type === 'BALLOON' ? 'default' : 'secondary'}>
                                {installment.type === 'BALLOON' ? 'Balão' : installment.type === 'DOWN_PAYMENT' ? 'Entrada' : 'Regular'}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDate(installment.dueDate)}</TableCell>
                            <TableCell className="font-medium">${parseFloat(installment.amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{daysOverdue} dias</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => handleMarkAsPaid(installment)}
                              >
                                Marcar como Pago
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Parcela #{selectedInstallment?.installmentNumber} - Property #{selectedInstallment?.propertyId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="paid-amount">Valor Pago</Label>
              <Input
                id="paid-amount"
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="paid-date">Data do Pagamento</Label>
              <Input
                id="paid-date"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="received-by">Recebido Por</Label>
              <Select value={receivedBy} onValueChange={(v: any) => setReceivedBy(v)}>
                <SelectTrigger id="received-by">
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
              <Label htmlFor="channel">Canal de Pagamento</Label>
              <Select value={channel} onValueChange={(v: any) => setChannel(v)}>
                <SelectTrigger id="channel">
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
              <Label htmlFor="memo">Observações</Label>
              <Input
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Notas adicionais..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitPayment}>
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
