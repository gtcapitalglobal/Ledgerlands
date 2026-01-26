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
import { ArrowLeft, Edit, DollarSign, TrendingUp, Calendar, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function AuditHistoryTable({ contractId }: { contractId: number }) {
  const { data: auditLog = [], isLoading } = trpc.auditLog.getForContract.useQuery({ contractId });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando histórico...</div>;
  }

  if (auditLog.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">Nenhuma alteração registrada</div>;
  }

  return (
    <div className="space-y-4">
      {auditLog.map((entry: any) => (
        <div key={entry.id} className="border-l-4 border-primary/30 pl-4 py-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{entry.field}</span>
                <Badge variant="outline" className="text-xs">{entry.entityType}</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">De:</span> {entry.oldValue || '(vazio)'}
                </div>
                <div>
                  <span className="font-medium">Para:</span> {entry.newValue || '(vazio)'}
                </div>
                <div className="mt-2 text-xs">
                  <span className="font-medium">Razão:</span> {entry.reason}
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{entry.changedBy}</div>
              <div>{new Date(entry.changedAt).toLocaleString('pt-BR')}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContractDetail() {
  const [, params] = useRoute("/contracts/:id");
  const contractId = params?.id ? parseInt(params.id) : 0;
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>('Other');

  const { data, isLoading } = trpc.contracts.getWithCalculations.useQuery({ 
    id: contractId,
    year: selectedYear 
  });
  
  const { data: attachments = [] } = trpc.attachments.list.useQuery({ contractId });
  const utils = trpc.useUtils();
  const updateContract = trpc.contracts.update.useMutation({
    onSuccess: () => {
      toast.success('Contrato atualizado com sucesso!');
      setIsEditModalOpen(false);
      utils.contracts.getWithCalculations.invalidate({ id: contractId, year: selectedYear });
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
  const uploadAttachment = trpc.attachments.upload.useMutation();
  const deleteAttachment = trpc.attachments.delete.useMutation({
    onSuccess: () => toast.success('Attachment deleted'),
  });
  
  const quickPayMutation = trpc.payments.quickPay.useMutation({
    onSuccess: () => {
      toast.success('Pagamento registrado com sucesso!');
      utils.payments.getByContractId.invalidate({ contractId });
      utils.contracts.getWithCalculations.invalidate({ id: contractId });
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao registrar pagamento');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setIsUploadDialogOpen(true);
    e.target.value = '';
  };

  const handleFileUpload = async () => {
    if (!uploadFile || !data?.contract) return;

    toast.info('Uploading...');
    const fileKey = `contracts/${data.contract.propertyId}/${Date.now()}-${uploadFile.name}`;
    
    try {
      const response = await fetch('/api/storage/upload?path=' + encodeURIComponent(fileKey), {
        method: 'POST',
        body: uploadFile,
      });
      const { url } = await response.json();

      await uploadAttachment.mutateAsync({
        contractId,
        fileName: uploadFile.name,
        fileUrl: url,
        fileKey,
        fileType: uploadFile.type,
        docType: uploadDocType as any,
        propertyId: data.contract.propertyId,
      });

      toast.success('File uploaded');
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setUploadDocType('Other');
      utils.attachments.list.invalidate({ contractId });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message || JSON.stringify(error)}`);
    }
  };

  const handleDeleteAttachment = async (id: number, fileName: string) => {
    if (!confirm(`Deletar documento "${fileName}"? Esta ação não pode ser desfeita.`)) return;
    await deleteAttachment.mutateAsync({ id });
    utils.attachments.list.invalidate({ contractId });
  };

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
            <Button className="shadow-elegant" onClick={() => {
              setEditFormData({
                propertyId: contract.propertyId,
                buyerName: contract.buyerName,
                county: contract.county,
                state: contract.state || 'FL',
                status: contract.status,
                notes: contract.notes || '',
                documentFolderLink: contract.documentFolderLink || '',
                contractPrice: contract.contractPrice,
                costBasis: contract.costBasis,
                downPayment: contract.downPayment || '0',
                installmentAmount: contract.installmentAmount || '',
                installmentCount: contract.installmentCount?.toString() || '',
                balloonAmount: contract.balloonAmount || '',
                balloonDate: contract.balloonDate || '',
              });
              setIsEditModalOpen(true);
            }}>
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
              <div className="flex gap-2">
                <Button 
                  onClick={() => quickPayMutation.mutate({ contractId: contract.id })}
                  disabled={quickPayMutation.isPending}
                  variant="default"
                  className="shadow-elegant"
                >
                  {quickPayMutation.isPending ? "Processando..." : "✓ Marcar como Pago"}
                </Button>
                <Button className="shadow-elegant" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Adicionar Pagamento
                </Button>
              </div>
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

        {/* Google Drive Folder Link */}
        {contract.documentFolderLink && (
          <Card className="shadow-elegant bg-primary/5 border-primary/20">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Pasta de Documentos no Google Drive</h3>
                    <p className="text-sm text-muted-foreground">Acesse todos os documentos deste contrato</p>
                  </div>
                </div>
                <Button 
                  onClick={() => contract.documentFolderLink && window.open(contract.documentFolderLink, '_blank')}
                  className="shadow-elegant"
                >
                  📁 Abrir no Drive
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attachments */}
        <Card className="shadow-elegant">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Documentos Anexados</CardTitle>
                <CardDescription>Upload e gestão de documentos do contrato</CardDescription>
              </div>
              <Button onClick={() => document.getElementById('file-upload')?.click()}>
                Upload
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </CardHeader>
          <CardContent>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento anexado</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge>{att.docType}</Badge>
                      <div>
                        <p className="font-medium">{att.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded by {att.uploadedBy} on {formatDate(att.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.open(att.fileUrl, '_blank')}>
                        Open
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteAttachment(att.id, att.fileName)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit History */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Histórico de Alterações (Audit Trail)</CardTitle>
            <CardDescription>Registro de mudanças em campos fiscais críticos</CardDescription>
          </CardHeader>
          <CardContent>
            <AuditHistoryTable contractId={contractId} />
          </CardContent>
        </Card>
      </div>

      {/* Edit Contract Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Contrato {contract?.propertyId}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const data: any = {
              id: contractId,
              propertyId: editFormData.propertyId,
              buyerName: editFormData.buyerName,
              county: editFormData.county,
              state: editFormData.state,
              status: editFormData.status,
              notes: editFormData.notes,
              documentFolderLink: editFormData.documentFolderLink || "",
              contractPrice: editFormData.contractPrice,
              costBasis: editFormData.costBasis,
              downPayment: editFormData.downPayment || "0",
              reason: editFormData.reason, // Required for audit log
            };
            if (contract?.saleType === "CFD") {
              data.installmentAmount = editFormData.installmentAmount;
              data.installmentCount = parseInt(editFormData.installmentCount);
              if (editFormData.balloonAmount) data.balloonAmount = editFormData.balloonAmount;
              if (editFormData.balloonDate) data.balloonDate = editFormData.balloonDate;
            }
            updateContract.mutate(data);
          }} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-propertyId">Property ID *</Label>
                <Input id="edit-propertyId" value={editFormData.propertyId} onChange={(e) => setEditFormData({...editFormData, propertyId: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-buyerName">Buyer Name *</Label>
                <Input id="edit-buyerName" value={editFormData.buyerName} onChange={(e) => setEditFormData({...editFormData, buyerName: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-county">County *</Label>
                <Input id="edit-county" value={editFormData.county} onChange={(e) => setEditFormData({...editFormData, county: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-state">State *</Label>
                <Input id="edit-state" value={editFormData.state} onChange={(e) => setEditFormData({...editFormData, state: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-contractPrice">Contract Price *</Label>
                <Input id="edit-contractPrice" type="number" step="0.01" value={editFormData.contractPrice} onChange={(e) => setEditFormData({...editFormData, contractPrice: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-costBasis">Cost Basis *</Label>
                <Input id="edit-costBasis" type="number" step="0.01" value={editFormData.costBasis} onChange={(e) => setEditFormData({...editFormData, costBasis: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-downPayment">Down Payment</Label>
                <Input id="edit-downPayment" type="number" step="0.01" value={editFormData.downPayment} onChange={(e) => setEditFormData({...editFormData, downPayment: e.target.value})} />
              </div>
              {contract?.saleType === "CFD" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-installmentAmount">Installment Amount</Label>
                    <Input id="edit-installmentAmount" type="number" step="0.01" value={editFormData.installmentAmount} onChange={(e) => setEditFormData({...editFormData, installmentAmount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-installmentCount">Installment Count</Label>
                    <Input id="edit-installmentCount" type="number" value={editFormData.installmentCount} onChange={(e) => setEditFormData({...editFormData, installmentCount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-balloonAmount">Balloon Amount</Label>
                    <Input id="edit-balloonAmount" type="number" step="0.01" value={editFormData.balloonAmount} onChange={(e) => setEditFormData({...editFormData, balloonAmount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-balloonDate">Balloon Date</Label>
                    <Input id="edit-balloonDate" type="date" value={editFormData.balloonDate} onChange={(e) => setEditFormData({...editFormData, balloonDate: e.target.value})} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status *</Label>
                <Select value={editFormData.status} onValueChange={(v: any) => setEditFormData({...editFormData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paid_off">Paid Off</SelectItem>
                    <SelectItem value="defaulted">Defaulted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea id="edit-notes" value={editFormData.notes} onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-documentFolderLink">Google Drive Folder Link</Label>
              <Input id="edit-documentFolderLink" type="url" value={editFormData.documentFolderLink || ""} onChange={(e) => setEditFormData({...editFormData, documentFolderLink: e.target.value})} placeholder="https://drive.google.com/drive/folders/..." />
              <p className="text-xs text-muted-foreground">Cole o link da pasta do Google Drive com os documentos deste contrato</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason for Edit (Audit Required) *</Label>
              <Textarea id="edit-reason" value={editFormData.reason || ''} onChange={(e) => setEditFormData({...editFormData, reason: e.target.value})} rows={2} placeholder="Explain why this contract is being modified (required for tax audit)" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateContract.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <p className="text-sm text-muted-foreground">{uploadFile?.name}</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Notice">Notice</SelectItem>
                  <SelectItem value="Deed">Deed</SelectItem>
                  <SelectItem value="Assignment">Assignment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setIsUploadDialogOpen(false);
                setUploadFile(null);
                setUploadDocType('Other');
              }}>Cancelar</Button>
              <Button onClick={handleFileUpload} disabled={uploadAttachment.isPending}>Upload</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
