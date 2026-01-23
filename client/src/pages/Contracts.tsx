import { useState, useMemo } from "react";
import Papa from "papaparse";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, ExternalLink, Upload, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Contracts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<any[]>([]);
  const [csvValidationErrors, setCsvValidationErrors] = useState<{row: number, field: string, message: string}[]>([]);
  const [formData, setFormData] = useState({
    propertyId: "",
    buyerName: "",
    county: "",
    state: "FL",
    originType: "DIRECT" as "DIRECT" | "ASSUMED",
    saleType: "CFD" as "CFD" | "CASH",
    contractDate: "",
    transferDate: "",
    closeDate: "",
    contractPrice: "",
    costBasis: "",
    downPayment: "",
    openingReceivable: "",
    installmentAmount: "",
    installmentCount: "",
    balloonAmount: "",
    balloonDate: "",
    status: "active" as "active" | "paid_off" | "defaulted",
    notes: "",
  });

  const { data: contracts, isLoading, refetch } = trpc.contracts.list.useQuery();
  const exportCSV = trpc.contracts.exportCSV.useQuery(undefined, { enabled: false });
  const createContract = trpc.contracts.create.useMutation({
    onSuccess: () => {
      toast.success("Contrato criado com sucesso!");
      setIsCreateModalOpen(false);
      setFormData({
        propertyId: "",
        buyerName: "",
        county: "",
        state: "FL",
        originType: "DIRECT",
        saleType: "CFD",
        contractDate: "",
        transferDate: "",
        closeDate: "",
        contractPrice: "",
        costBasis: "",
        downPayment: "",
        openingReceivable: "",
        installmentAmount: "",
        installmentCount: "",
        balloonAmount: "",
        balloonDate: "",
        status: "active",
        notes: "",
      });
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao criar contrato: ${error.message}`);
    },
  });
  const deleteContract = trpc.contracts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contrato deletado com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao deletar contrato: ${error.message}`);
    },
  });
  const importCSV = trpc.contracts.importCSV.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Imported ${result.imported} contracts`);
        refetch(); // Refresh contracts list
      } else {
        toast.error(`Import failed: ${result.errors.length} errors`);
        result.errors.forEach(err => toast.error(`Row ${err.row}: ${err.message}`));
      }
    },
    onError: (error) => {
      toast.error(`Import error: ${error.message}`);
      console.error('Import CSV error:', error);
    },
  });

  const validateCSVRow = (row: any, index: number) => {
    const errors: {row: number, field: string, message: string}[] = [];
    const requiredFields = ['property_id', 'buyer_name', 'origin_type', 'sale_type', 'county', 'state', 'contract_date', 'contract_price', 'cost_basis', 'down_payment'];
    
    requiredFields.forEach(field => {
      if (!row[field] || row[field].toString().trim() === '') {
        errors.push({ row: index + 2, field, message: `Campo obrigatório vazio: ${field}` });
      }
    });
    
    // Validate origin_type
    if (row.origin_type && !['DIRECT', 'ASSUMED'].includes(row.origin_type)) {
      errors.push({ row: index + 2, field: 'origin_type', message: `Valor inválido: deve ser DIRECT ou ASSUMED` });
    }
    
    // Validate sale_type
    if (row.sale_type && !['CFD', 'CASH'].includes(row.sale_type)) {
      errors.push({ row: index + 2, field: 'sale_type', message: `Valor inválido: deve ser CFD ou CASH` });
    }
    
    // Validate dates
    if (row.contract_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.contract_date)) {
      errors.push({ row: index + 2, field: 'contract_date', message: `Data inválida: use formato YYYY-MM-DD` });
    }
    
    // Validate numbers
    ['contract_price', 'cost_basis', 'down_payment'].forEach(field => {
      if (row[field] && isNaN(parseFloat(row[field]))) {
        errors.push({ row: index + 2, field, message: `Valor numérico inválido` });
      }
    });
    
    // Conditional validations
    if (row.origin_type === 'ASSUMED') {
      if (!row.transfer_date) errors.push({ row: index + 2, field: 'transfer_date', message: `transfer_date obrigatório para ASSUMED` });
      if (!row.opening_receivable) errors.push({ row: index + 2, field: 'opening_receivable', message: `opening_receivable obrigatório para ASSUMED` });
    }
    
    if (row.sale_type === 'CFD') {
      if (!row.installment_amount) errors.push({ row: index + 2, field: 'installment_amount', message: `installment_amount obrigatório para CFD` });
      if (!row.installment_count) errors.push({ row: index + 2, field: 'installment_count', message: `installment_count obrigatório para CFD` });
    }
    
    if (row.sale_type === 'CASH' && !row.close_date) {
      errors.push({ row: index + 2, field: 'close_date', message: `close_date obrigatório para CASH` });
    }
    
    return errors;
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        
        // Validate all rows
        const allErrors: {row: number, field: string, message: string}[] = [];
        rows.forEach((row, index) => {
          const errors = validateCSVRow(row, index);
          allErrors.push(...errors);
        });
        
        setCsvPreviewData(rows);
        setCsvValidationErrors(allErrors);
        setIsPreviewModalOpen(true);
      },
      error: (error: any) => {
        toast.error(`CSV parse error: ${error.message}`);
      }
    });
    e.target.value = '';
  };
  
  const confirmImport = () => {
    console.log('[CSV Import] Starting import...');
    console.log('[CSV Import] Validation errors:', csvValidationErrors.length);
    
    if (csvValidationErrors.length > 0) {
      toast.error('Corrija os erros antes de importar');
      return;
    }
    
    console.log('[CSV Import] Raw CSV data:', csvPreviewData);
    
    // Map CSV fields (snake_case) to backend fields (camelCase)
    const rows = csvPreviewData.map((row: any) => ({
      propertyId: row.property_id,
      buyerName: row.buyer_name,
      county: row.county,
      state: row.state,
      originType: row.origin_type,
      saleType: row.sale_type,
      contractDate: row.contract_date,
      transferDate: row.transfer_date || undefined,
      closeDate: row.close_date || undefined,
      contractPrice: row.contract_price,
      costBasis: row.cost_basis,
      downPayment: row.down_payment,
      openingReceivable: row.opening_receivable || undefined,
      installmentAmount: row.installment_amount || undefined,
      installmentCount: row.installment_count ? parseInt(row.installment_count) : undefined,
      balloonAmount: row.balloon_amount || undefined,
      balloonDate: row.balloon_date || undefined,
      status: 'Active' as 'Active' | 'PaidOff' | 'Default' | 'Repossessed',
      notes: row.notes || undefined,
    }));
    
    console.log('[CSV Import] Mapped rows:', rows);
    console.log('[CSV Import] Calling mutation...');
    
    importCSV.mutate({ rows });
    setIsPreviewModalOpen(false);
    setCsvPreviewData([]);
    setCsvValidationErrors([]);
  };

  const filteredContracts = useMemo(() => {
    if (!contracts) return [];
    
    return contracts.filter(contract => {
      const matchesSearch = 
        contract.propertyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.county.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      const matchesType = typeFilter === "all" || contract.originType === typeFilter;
      
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [contracts, searchTerm, statusFilter, typeFilter]);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Contratos</h1>
            <p className="text-muted-foreground mt-2">
              Gestão completa de contratos de financiamento
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const result = await exportCSV.refetch();
                if (result.data) {
                  const blob = new Blob([result.data.csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = result.data.filename;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('CSV exportado com sucesso');
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="outline" onClick={() => document.getElementById('csv-import')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
            <input
              id="csv-import"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVImport}
            />
            <Button className="shadow-elegant" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contrato
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Filtros e Busca</CardTitle>
            <CardDescription>Encontre contratos rapidamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Property ID, Buyer, County..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                <Select value={typeFilter} onValueChange={setTypeFilter}>
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
            </div>
          </CardContent>
        </Card>

        {/* Contracts Table */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>
              {filteredContracts.length} {filteredContracts.length === 1 ? 'Contrato' : 'Contratos'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-full" />
                  </div>
                ))}
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum contrato encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead>Contract Date</TableHead>
                      <TableHead className="text-right">Contract Price</TableHead>
                      <TableHead className="text-right">Cost Basis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => (
                      <TableRow key={contract.id} className="hover:bg-muted/50 cursor-pointer">
                        <TableCell className="font-medium">
                          <Link href={`/contracts/${contract.id}`}>
                            <span className="text-primary hover:underline">{contract.propertyId}</span>
                          </Link>
                        </TableCell>
                        <TableCell>{contract.buyerName}</TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(contract.originType)}>
                            {contract.originType}
                          </Badge>
                        </TableCell>
                        <TableCell>{contract.county}</TableCell>
                        <TableCell>{formatDate(contract.contractDate)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(contract.contractPrice)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(contract.costBasis)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(contract.status)}>
                            {contract.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/contracts/${contract.id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Tem certeza que deseja deletar o contrato ${contract.propertyId}? Esta ação não pode ser desfeita.`)) {
                                  deleteContract.mutate({ id: contract.id });
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Create Contract Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Contrato</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const data: any = {
              propertyId: formData.propertyId,
              buyerName: formData.buyerName,
              county: formData.county,
              state: formData.state,
              originType: formData.originType,
              saleType: formData.saleType,
              contractDate: formData.contractDate,
              contractPrice: formData.contractPrice,
              costBasis: formData.costBasis,
              downPayment: formData.downPayment || "0",
              status: formData.status,
              notes: formData.notes || "",
            };
            if (formData.originType === "ASSUMED") {
              data.transferDate = formData.transferDate;
              data.openingReceivable = formData.openingReceivable;
            }
            if (formData.saleType === "CFD") {
              data.installmentAmount = formData.installmentAmount;
              data.installmentCount = parseInt(formData.installmentCount);
              if (formData.balloonAmount) data.balloonAmount = formData.balloonAmount;
              if (formData.balloonDate) data.balloonDate = formData.balloonDate;
            }
            if (formData.saleType === "CASH") {
              data.closeDate = formData.closeDate;
            }
            createContract.mutate(data);
          }} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="propertyId">Property ID *</Label>
                <Input id="propertyId" value={formData.propertyId} onChange={(e) => setFormData({...formData, propertyId: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyerName">Buyer Name *</Label>
                <Input id="buyerName" value={formData.buyerName} onChange={(e) => setFormData({...formData, buyerName: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="county">County *</Label>
                <Input id="county" value={formData.county} onChange={(e) => setFormData({...formData, county: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input id="state" value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="originType">Origin Type *</Label>
                <Select value={formData.originType} onValueChange={(v: any) => setFormData({...formData, originType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECT">DIRECT</SelectItem>
                    <SelectItem value="ASSUMED">ASSUMED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="saleType">Sale Type *</Label>
                <Select value={formData.saleType} onValueChange={(v: any) => setFormData({...formData, saleType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CFD">CFD</SelectItem>
                    <SelectItem value="CASH">CASH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractDate">Contract Date *</Label>
                <Input id="contractDate" type="date" value={formData.contractDate} onChange={(e) => setFormData({...formData, contractDate: e.target.value})} required />
              </div>
              {formData.originType === "ASSUMED" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="transferDate">Transfer Date *</Label>
                    <Input id="transferDate" type="date" value={formData.transferDate} onChange={(e) => setFormData({...formData, transferDate: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openingReceivable">Opening Receivable *</Label>
                    <Input id="openingReceivable" type="number" step="0.01" value={formData.openingReceivable} onChange={(e) => setFormData({...formData, openingReceivable: e.target.value})} required />
                  </div>
                </>
              )}
              {formData.saleType === "CASH" && (
                <div className="space-y-2">
                  <Label htmlFor="closeDate">Close Date *</Label>
                  <Input id="closeDate" type="date" value={formData.closeDate} onChange={(e) => setFormData({...formData, closeDate: e.target.value})} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="contractPrice">Contract Price *</Label>
                <Input id="contractPrice" type="number" step="0.01" value={formData.contractPrice} onChange={(e) => setFormData({...formData, contractPrice: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costBasis">Cost Basis *</Label>
                <Input id="costBasis" type="number" step="0.01" value={formData.costBasis} onChange={(e) => setFormData({...formData, costBasis: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="downPayment">Down Payment</Label>
                <Input id="downPayment" type="number" step="0.01" value={formData.downPayment} onChange={(e) => setFormData({...formData, downPayment: e.target.value})} />
              </div>
              {formData.saleType === "CFD" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="installmentAmount">Installment Amount *</Label>
                    <Input id="installmentAmount" type="number" step="0.01" value={formData.installmentAmount} onChange={(e) => setFormData({...formData, installmentAmount: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installmentCount">Installment Count *</Label>
                    <Input id="installmentCount" type="number" value={formData.installmentCount} onChange={(e) => setFormData({...formData, installmentCount: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balloonAmount">Balloon Amount</Label>
                    <Input id="balloonAmount" type="number" step="0.01" value={formData.balloonAmount} onChange={(e) => setFormData({...formData, balloonAmount: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balloonDate">Balloon Date</Label>
                    <Input id="balloonDate" type="date" value={formData.balloonDate} onChange={(e) => setFormData({...formData, balloonDate: e.target.value})} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={(v: any) => setFormData({...formData, status: v})}>
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
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createContract.isPending}>Criar Contrato</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV Preview Modal */}
      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview CSV Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {csvValidationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
                <h3 className="font-semibold text-destructive mb-2">{csvValidationErrors.length} Erros Encontrados:</h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {csvValidationErrors.map((err, i) => (
                    <p key={i} className="text-sm text-destructive">Linha {err.row}, Campo "{err.field}": {err.message}</p>
                  ))}
                </div>
              </div>
            )}
            {csvValidationErrors.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium">✓ Todos os {csvPreviewData.length} registros estão válidos!</p>
              </div>
            )}
            <div>
              <h3 className="font-semibold mb-2">Preview dos Dados ({csvPreviewData.length} contratos):</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sale Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>County</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreviewData.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.property_id}</TableCell>
                        <TableCell>{row.buyer_name}</TableCell>
                        <TableCell>{row.origin_type}</TableCell>
                        <TableCell>{row.sale_type}</TableCell>
                        <TableCell>{row.contract_price}</TableCell>
                        <TableCell>{row.county}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {csvPreviewData.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center py-2">... e mais {csvPreviewData.length - 10} registros</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setIsPreviewModalOpen(false);
                setCsvPreviewData([]);
                setCsvValidationErrors([]);
              }}>Cancelar</Button>
              <Button 
                onClick={confirmImport} 
                disabled={csvValidationErrors.length > 0 || importCSV.isPending}
              >
                {csvValidationErrors.length > 0 ? 'Corrija os Erros' : `Importar ${csvPreviewData.length} Contratos`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
