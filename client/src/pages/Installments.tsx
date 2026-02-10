import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, DollarSign } from "lucide-react";


export default function Installments() {
  const [propertyFilter, setPropertyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "PAID" | "OVERDUE" | "PARTIAL" | "">("");
  const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  
  // Payment form state
  const [paidAmount, setPaidAmount] = useState("");
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedBy, setReceivedBy] = useState<"GT_REAL_BANK" | "LEGACY_G&T" | "PERSONAL" | "UNKNOWN">("GT_REAL_BANK");
  const [channel, setChannel] = useState<"ZELLE" | "ACH" | "CASH" | "CHECK" | "WIRE" | "OTHER">("CHECK");
  const [memo, setMemo] = useState("");

  const { data: installments = [], isLoading, refetch } = trpc.installments.list.useQuery({
    propertyId: propertyFilter || undefined,
    status: statusFilter || undefined,
  });

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
      <div>
        <h1 className="text-3xl font-bold">Parcelas</h1>
        <p className="text-muted-foreground">Gestão de vencimentos e pagamentos mensais</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Property ID</Label>
            <Input
              placeholder="Ex: 25"
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
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
                      <TableCell>{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>${parseFloat(inst.amount).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(inst.status)}</TableCell>
                      <TableCell>
                        {inst.paidDate ? new Date(inst.paidDate).toLocaleDateString('pt-BR') : '-'}
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
