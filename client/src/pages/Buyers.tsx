import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, UserPlus, FileText, Copy, ExternalLink, Users, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800",
  PSA_SENT: "bg-yellow-100 text-yellow-800",
  CFD_SENT: "bg-orange-100 text-orange-800",
  CONTRACTED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Novo",
  PSA_SENT: "PSA Enviado",
  CFD_SENT: "CFD Enviado",
  CONTRACTED: "Contratado",
  CANCELLED: "Cancelado",
};

export default function Buyers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBuyer, setSelectedBuyer] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateContractOpen, setIsCreateContractOpen] = useState(false);

  // Property data form for PSA/CFD generation
  const [propertyForm, setPropertyForm] = useState({
    propertyAddress: "",
    parcelId: "",
    legalDescription: "",
    purchasePrice: "",
    downPayment: "",
    monthlyPayment: "",
    installments: "",
    dueDay: "15",
    costBasis: "",
    county: "Putnam",
    state: "FL",
    firstPaymentDate: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });

  const { data: buyers, isLoading, refetch } = trpc.buyers.list.useQuery();
  
  const updateStatus = trpc.buyers.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      refetch();
    },
  });

  const createContractFromBuyer = trpc.buyers.createContractFromBuyer.useMutation({
    onSuccess: (data) => {
      toast.success("Contrato criado com sucesso! ID: " + data.contractId);
      setIsCreateContractOpen(false);
      refetch();
    },
    onError: (err) => {
      toast.error("Erro ao criar contrato: " + err.message);
    },
  });

  const filteredBuyers = useMemo(() => {
    if (!buyers) return [];
    return buyers.filter((b: any) => {
      const matchSearch =
        !searchTerm ||
        b.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.phone.includes(searchTerm);
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [buyers, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    if (!buyers) return { total: 0, new_count: 0, contracted: 0, pending: 0 };
    return {
      total: buyers.length,
      new_count: buyers.filter((b: any) => b.status === "NEW").length,
      contracted: buyers.filter((b: any) => b.status === "CONTRACTED").length,
      pending: buyers.filter((b: any) => ["PSA_SENT", "CFD_SENT"].includes(b.status)).length,
    };
  }, [buyers]);

  const handleOpenDetail = (buyer: any) => {
    setSelectedBuyer(buyer);
    setIsDetailOpen(true);
  };

  const handleStartContract = (buyer: any) => {
    setSelectedBuyer(buyer);
    // Pre-fill effective date with today
    setPropertyForm((prev) => ({
      ...prev,
      effectiveDate: new Date().toISOString().split("T")[0],
    }));
    setIsCreateContractOpen(true);
  };

  const handleCreateContract = () => {
    if (!selectedBuyer) return;
    if (!propertyForm.propertyAddress || !propertyForm.parcelId || !propertyForm.downPayment || !propertyForm.monthlyPayment || !propertyForm.installments) {
      toast.error("Preencha todos os campos obrigatórios da propriedade.");
      return;
    }

    const balance = Number(propertyForm.monthlyPayment) * Number(propertyForm.installments);
    const purchasePrice = Number(propertyForm.downPayment) + balance;

    createContractFromBuyer.mutate({
      buyerId: selectedBuyer.id,
      propertyAddress: propertyForm.propertyAddress,
      parcelId: propertyForm.parcelId,
      legalDescription: propertyForm.legalDescription,
      purchasePrice: purchasePrice.toString(),
      downPayment: propertyForm.downPayment,
      monthlyPayment: propertyForm.monthlyPayment,
      installments: Number(propertyForm.installments),
      costBasis: propertyForm.costBasis || "0",
      county: propertyForm.county,
      state: propertyForm.state,
      effectiveDate: propertyForm.effectiveDate,
      firstPaymentDate: propertyForm.firstPaymentDate,
      dueDay: propertyForm.dueDay,
    });
  };

  const copyFormLink = () => {
    const link = window.location.origin + "/buyer-form";
    navigator.clipboard.writeText(link);
    toast.success("Link copiado! Envie para o cliente.");
  };

  const generatePSAMessage = (buyer: any) => {
    const name = buyer.coBuyerName
      ? `${buyer.fullName} and ${buyer.coBuyerName}`
      : buyer.fullName;
    return `Hi ${name},

Here is your Purchase and Sale Agreement (PSA) for the property.

Please review it carefully and sign it electronically. 
If you have any questions, just let me know.

Best regards,
Gustavo
GT Lands`;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Compradores (Buyers)</h1>
            <p className="text-muted-foreground">
              Gerencie os clientes que preencheram o formulário
            </p>
          </div>
          <Button onClick={copyFormLink} variant="outline" className="gap-2">
            <Copy className="h-4 w-4" />
            Copiar link do formulário
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <UserPlus className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.new_count}</p>
                  <p className="text-xs text-muted-foreground">Novos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Em andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.contracted}</p>
                  <p className="text-xs text-muted-foreground">Contratados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="NEW">Novo</SelectItem>
              <SelectItem value="PSA_SENT">PSA Enviado</SelectItem>
              <SelectItem value="CFD_SENT">CFD Enviado</SelectItem>
              <SelectItem value="CONTRACTED">Contratado</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade/Estado</TableHead>
                    <TableHead>Co-Buyer</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBuyers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum comprador encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBuyers.map((buyer: any) => (
                      <TableRow key={buyer.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium" onClick={() => handleOpenDetail(buyer)}>
                          {buyer.fullName}
                          {buyer.personalOrBusiness === "Business" && (
                            <span className="ml-1 text-xs text-muted-foreground">({buyer.businessName})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{buyer.email}</TableCell>
                        <TableCell className="text-sm">{buyer.phone}</TableCell>
                        <TableCell className="text-sm">{buyer.city}, {buyer.state}</TableCell>
                        <TableCell>
                          {buyer.hasCoBuyer ? (
                            <span className="text-sm text-blue-600">{buyer.coBuyerName}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{buyer.preferredPayment}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[buyer.status] || "bg-gray-100"}>
                            {STATUS_LABELS[buyer.status] || buyer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(buyer.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {buyer.status === "NEW" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-emerald-700"
                                onClick={() => handleStartContract(buyer)}
                              >
                                <FileText className="h-3 w-3" />
                                Criar Contrato
                              </Button>
                            )}
                            {buyer.contractId && (
                              <Link href={`/contracts/${buyer.contractId}`}>
                                <Button size="sm" variant="ghost" className="gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  Ver contrato
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Comprador</DialogTitle>
            </DialogHeader>
            {selectedBuyer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-muted-foreground">Nome</p>
                    <p>{selectedBuyer.fullName}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Tipo</p>
                    <p>{selectedBuyer.personalOrBusiness}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Email</p>
                    <p>{selectedBuyer.email}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Telefone</p>
                    <p>{selectedBuyer.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-semibold text-muted-foreground">Endereço</p>
                    <p>{selectedBuyer.streetAddress}, {selectedBuyer.city}, {selectedBuyer.state} {selectedBuyer.zipCode}</p>
                  </div>
                  {selectedBuyer.hasCoBuyer === 1 && (
                    <>
                      <div>
                        <p className="font-semibold text-muted-foreground">Co-Buyer</p>
                        <p>{selectedBuyer.coBuyerName}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Co-Buyer Email</p>
                        <p>{selectedBuyer.coBuyerEmail}</p>
                      </div>
                    </>
                  )}
                  {selectedBuyer.personalOrBusiness === "Business" && (
                    <>
                      <div>
                        <p className="font-semibold text-muted-foreground">Empresa</p>
                        <p>{selectedBuyer.businessName}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Representante</p>
                        <p>{selectedBuyer.representativeName}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="font-semibold text-muted-foreground">Pagamento Preferido</p>
                    <p>{selectedBuyer.preferredPayment}</p>
                  </div>
                  {selectedBuyer.driverLicenseUrl && (
                    <div>
                      <p className="font-semibold text-muted-foreground">Driver License</p>
                      <a href={selectedBuyer.driverLicenseUrl} target="_blank" rel="noopener" className="text-blue-600 underline text-sm">
                        Ver documento
                      </a>
                    </div>
                  )}
                </div>

                {/* Status update */}
                <div className="border-t pt-4 space-y-2">
                  <Label>Atualizar Status</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedBuyer.status}
                      onValueChange={(v) => {
                        updateStatus.mutate({ id: selectedBuyer.id, status: v as any });
                        setSelectedBuyer({ ...selectedBuyer, status: v });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW">Novo</SelectItem>
                        <SelectItem value="PSA_SENT">PSA Enviado</SelectItem>
                        <SelectItem value="CFD_SENT">CFD Enviado</SelectItem>
                        <SelectItem value="CONTRACTED">Contratado</SelectItem>
                        <SelectItem value="CANCELLED">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Copy PSA message */}
                <div className="border-t pt-4">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(generatePSAMessage(selectedBuyer));
                      toast.success("Mensagem copiada!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copiar mensagem padrão para o cliente
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Contract Modal */}
        <Dialog open={isCreateContractOpen} onOpenChange={setIsCreateContractOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Contrato — {selectedBuyer?.fullName}</DialogTitle>
              <DialogDescription>
                Preencha os dados da propriedade para gerar o PSA e o Contract for Deed.
              </DialogDescription>
            </DialogHeader>
            {selectedBuyer && (
              <div className="space-y-4">
                {/* Buyer info summary */}
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <p><strong>Buyer:</strong> {selectedBuyer.fullName} {selectedBuyer.coBuyerName ? `and ${selectedBuyer.coBuyerName}` : ""}</p>
                  <p><strong>Email:</strong> {selectedBuyer.email}</p>
                  <p><strong>Endereço:</strong> {selectedBuyer.streetAddress}, {selectedBuyer.city}, {selectedBuyer.state} {selectedBuyer.zipCode}</p>
                </div>

                {/* Property data */}
                <h3 className="font-semibold border-t pt-4">Dados da Propriedade</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Endereço da Propriedade *</Label>
                    <Input
                      placeholder="123 Main Ave, Interlachen, FL 32148"
                      value={propertyForm.propertyAddress}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, propertyAddress: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Parcel ID *</Label>
                    <Input
                      placeholder="35-09-24-4076-0360-0160"
                      value={propertyForm.parcelId}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, parcelId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>County</Label>
                    <Input
                      placeholder="Putnam"
                      value={propertyForm.county}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, county: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Legal Description</Label>
                    <Textarea
                      placeholder="INTERLACHEN LAKES ESTATES..."
                      value={propertyForm.legalDescription}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, legalDescription: e.target.value }))}
                    />
                  </div>
                </div>

                <h3 className="font-semibold border-t pt-4">Dados Financeiros</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Down Payment (USD) *</Label>
                    <Input
                      type="number"
                      placeholder="499"
                      value={propertyForm.downPayment}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, downPayment: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor da Parcela (USD) *</Label>
                    <Input
                      type="number"
                      placeholder="220"
                      value={propertyForm.monthlyPayment}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, monthlyPayment: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade de Parcelas *</Label>
                    <Input
                      type="number"
                      placeholder="48"
                      value={propertyForm.installments}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, installments: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost Basis (USD)</Label>
                    <Input
                      type="number"
                      placeholder="3500"
                      value={propertyForm.costBasis}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, costBasis: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Calculated values */}
                {propertyForm.downPayment && propertyForm.monthlyPayment && propertyForm.installments && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm space-y-1">
                    <p><strong>Purchase Price:</strong> ${(Number(propertyForm.downPayment) + Number(propertyForm.monthlyPayment) * Number(propertyForm.installments)).toLocaleString()}</p>
                    <p><strong>Balance:</strong> ${(Number(propertyForm.monthlyPayment) * Number(propertyForm.installments)).toLocaleString()}</p>
                  </div>
                )}

                <h3 className="font-semibold border-t pt-4">Datas</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Effective Date (Data do Contrato)</Label>
                    <Input
                      type="date"
                      value={propertyForm.effectiveDate}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, effectiveDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>First Payment Date</Label>
                    <Input
                      type="date"
                      value={propertyForm.firstPaymentDate}
                      onChange={(e) => setPropertyForm((p) => ({ ...p, firstPaymentDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dia dos Pagamentos Mensais</Label>
                    <Select value={propertyForm.dueDay} onValueChange={(v) => setPropertyForm((p) => ({ ...p, dueDay: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">Todo dia 15</SelectItem>
                        <SelectItem value="25">Todo dia 25</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 border-t pt-4">
                  <Button
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 gap-2"
                    onClick={handleCreateContract}
                    disabled={createContractFromBuyer.isPending}
                  >
                    <FileText className="h-4 w-4" />
                    Criar Contrato no Ledgerlands
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateContractOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
