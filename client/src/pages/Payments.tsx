import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Upload, Download, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Payments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [receivedByFilter, setReceivedByFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: payments, isLoading, refetch } = trpc.payments.list.useQuery();
  const { data: contracts } = trpc.contracts.list.useQuery();

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    
    return payments.filter(payment => {
      const matchesSearch = 
        payment.propertyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (payment.memo && payment.memo.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesReceivedBy = receivedByFilter === "all" || payment.receivedBy === receivedByFilter;
      const matchesChannel = channelFilter === "all" || payment.channel === channelFilter;
      
      return matchesSearch && matchesReceivedBy && matchesChannel;
    });
  }, [payments, searchTerm, receivedByFilter, channelFilter]);

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
      month: 'short',
      day: 'numeric',
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        toast.error("CSV file is empty or invalid");
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['property_id', 'payment_date', 'amount_total', 'principal_amount', 'late_fee_amount', 'received_by', 'channel'];
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(', ')}`);
        return;
      }

      const rows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index];
        });
        return row;
      });

      toast.success(`Parsed ${rows.length} payments from CSV. Import functionality coming soon.`);
      
    } catch (error) {
      toast.error("Failed to parse CSV file");
      console.error(error);
    }
  };

  const handleDownloadTemplate = () => {
    const template = `property_id,payment_date,amount_total,principal_amount,late_fee_amount,received_by,channel,memo
#33,2026-01-15,1500.00,1400.00,100.00,GT_REAL_BANK,ZELLE,January payment
#34,2026-01-15,1200.00,1200.00,0.00,GT_REAL_BANK,ACH,Regular payment`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payments_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportLedger = () => {
    if (!payments || payments.length === 0) {
      toast.error("No payments to export");
      return;
    }

    const headers = ['Property ID', 'Payment Date', 'Total Amount', 'Principal Amount', 'Late Fee Amount', 'Received By', 'Channel', 'Memo'];
    const rows = payments.map(p => [
      p.propertyId,
      formatDate(p.paymentDate),
      p.amountTotal,
      p.principalAmount,
      p.lateFeeAmount,
      p.receivedBy,
      p.channel,
      p.memo || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success("Payments ledger exported successfully");
  };

  const getReceivedByColor = (receivedBy: string) => {
    switch (receivedBy) {
      case "GT_REAL_BANK":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "LEGACY_G&T":
        return "bg-amber-100 text-amber-800 hover:bg-amber-100";
      case "PERSONAL":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Payments Ledger</h1>
            <p className="text-muted-foreground mt-2">
              Registro completo de todos os pagamentos recebidos
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleExportLedger} className="shadow-elegant">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button className="shadow-elegant">
              <Plus className="h-4 w-4 mr-2" />
              Novo Pagamento
            </Button>
          </div>
        </div>

        {/* Import Section */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Import Payments</CardTitle>
            <CardDescription>Upload CSV file to import multiple payments at once</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="shadow-elegant"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleDownloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with payment data. Required columns: property_id, payment_date, amount_total, principal_amount, late_fee_amount, received_by, channel
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Filters and Search */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Filtros e Busca</CardTitle>
            <CardDescription>Encontre pagamentos rapidamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Property ID, Memo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Received By</label>
                <Select value={receivedByFilter} onValueChange={setReceivedByFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="GT_REAL_BANK">GT Real Bank</SelectItem>
                    <SelectItem value="LEGACY_G&T">Legacy G&T</SelectItem>
                    <SelectItem value="PERSONAL">Personal</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ZELLE">Zelle</SelectItem>
                    <SelectItem value="ACH">ACH</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CHECK">Check</SelectItem>
                    <SelectItem value="WIRE">Wire</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>
              {filteredPayments.length} {filteredPayments.length === 1 ? 'Pagamento' : 'Pagamentos'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum pagamento encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Property #</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Late Fee</TableHead>
                      <TableHead>Received By</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Memo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {formatDate(payment.paymentDate)}
                        </TableCell>
                        <TableCell className="font-medium text-primary">
                          {payment.propertyId}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(payment.amountTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(payment.principalAmount)}
                        </TableCell>
                        <TableCell className="text-right text-accent-foreground font-medium">
                          {formatCurrency(payment.lateFeeAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getReceivedByColor(payment.receivedBy)}>
                            {payment.receivedBy.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{payment.channel}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
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
