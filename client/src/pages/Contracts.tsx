import { useState, useMemo } from "react";
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
import { Search, Plus, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Contracts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: contracts, isLoading } = trpc.contracts.list.useQuery();
  const importCSV = trpc.contracts.importCSV.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Imported ${result.imported} contracts`);
      } else {
        toast.error(`Import failed: ${result.errors.length} errors`);
        result.errors.forEach(err => toast.error(`Row ${err.row}: ${err.message}`));
      }
    },
  });

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',');
    const rows = lines.slice(1).map(line => {
      const values = line.split(',');
      const row: any = {};
      headers.forEach((h, i) => {
        const key = h.trim();
        const val = values[i]?.trim();
        if (key === 'installmentCount') row[key] = val ? parseInt(val) : undefined;
        else row[key] = val || undefined;
      });
      return row;
    });

    importCSV.mutate({ rows });
    e.target.value = '';
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
            <Button variant="outline" onClick={() => document.getElementById('csv-import')?.click()}>
              Importar CSV
            </Button>
            <input
              id="csv-import"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVImport}
            />
            <Button className="shadow-elegant">
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
                          <Link href={`/contracts/${contract.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>
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
