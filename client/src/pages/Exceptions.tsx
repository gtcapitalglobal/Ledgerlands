import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Exceptions() {
  const { data: exceptions, isLoading } = trpc.exceptions.listAll.useQuery();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-100 text-red-800 hover:bg-red-100";
      case "HIGH":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      MISSING_COST_BASIS: "Cost Basis Missing",
      MISSING_TRANSFER_DATE: "Transfer Date Missing",
      MISSING_OPENING_RECEIVABLE: "Opening Receivable Missing",
      NEGATIVE_RECEIVABLE: "Negative Receivable",
      PAYMENT_MISMATCH: "Payment Amount Mismatch",
      MISSING_CLOSE_DATE: "Close Date Missing",
      MISSING_DOCS: "Missing Documents",
    };
    return labels[type] || type;
  };

  const criticalCount = exceptions?.filter(e => e.severity === 'CRITICAL').length || 0;
  const highCount = exceptions?.filter(e => e.severity === 'HIGH').length || 0;
  const mediumCount = exceptions?.filter(e => e.severity === 'MEDIUM').length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Exceções de Validação</h1>
          <p className="text-muted-foreground mt-2">
            Problemas bloqueantes que requerem correção para compliance fiscal
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Críticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Requerem ação imediata</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Altas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{highCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Corrigir em breve</p>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Médias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{mediumCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Revisar quando possível</p>
            </CardContent>
          </Card>
        </div>

        {/* Exceptions Table */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Todas as Exceções</CardTitle>
            <CardDescription>
              Lista completa de validações falhadas. Clique em "Corrigir" para ir direto ao contrato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : exceptions && exceptions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Propriedade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptions.map((exception) => (
                    <TableRow key={exception.id}>
                      <TableCell>
                        <Badge className={getSeverityColor(exception.severity)}>
                          {exception.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{exception.propertyId}</TableCell>
                      <TableCell>{getTypeLabel(exception.type)}</TableCell>
                      <TableCell className="max-w-md">{exception.message}</TableCell>
                      <TableCell className="text-right">
                        <Link href={exception.deepLink}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Corrigir
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma Exceção Encontrada</h3>
                <p className="text-muted-foreground">
                  Todos os contratos estão em conformidade! 🎉
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
