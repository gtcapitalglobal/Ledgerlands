import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, FileWarning, Calendar, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Exceptions() {
  const [, setLocation] = useLocation();
  const { data: exceptions, isLoading } = trpc.exceptions.list.useQuery();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Exceções de Validação (QC Automático)</h1>
            <p className="text-muted-foreground mt-2">
              Verificação automática de qualidade dos dados
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!exceptions) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Exceções de Validação (QC Automático)</h1>
            <p className="text-muted-foreground mt-2">
              Nenhum dado disponível
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalExceptions = 
    exceptions.missingRequiredFields.count +
    exceptions.cfdMissingInstallment.count +
    exceptions.assumedMissingData.count +
    exceptions.balloonMissingDate.count +
    exceptions.paymentsBeforeContract.count +
    exceptions.assumedPaymentsBeforeTransfer.count;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Exceções de Validação (QC Automático)</h1>
          <p className="text-muted-foreground mt-2">
            Verificação automática de qualidade dos dados - {totalExceptions} exceções encontradas
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Missing Required Fields */}
          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer border-red-200" onClick={() => document.getElementById('missing-required')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Campos Obrigatórios Faltando
              </CardTitle>
              <FileWarning className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{exceptions.missingRequiredFields.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Contratos sem campos essenciais
              </p>
            </CardContent>
          </Card>

          {/* CFD Missing Installment */}
          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer border-orange-200" onClick={() => document.getElementById('cfd-missing')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                CFD sem Dados de Parcela
              </CardTitle>
              <DollarSign className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{exceptions.cfdMissingInstallment.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                CFD sem installmentAmount/Count
              </p>
            </CardContent>
          </Card>

          {/* ASSUMED Missing Data */}
          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer border-orange-200" onClick={() => document.getElementById('assumed-missing')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ASSUMED sem Dados
              </CardTitle>
              <Calendar className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{exceptions.assumedMissingData.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Sem transferDate ou W
              </p>
            </CardContent>
          </Card>

          {/* Balloon Missing Date */}
          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer border-yellow-200" onClick={() => document.getElementById('balloon-missing')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Balloon sem Data
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{exceptions.balloonMissingDate.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Balloon &gt; 0 sem balloonDate
              </p>
            </CardContent>
          </Card>

          {/* Payments Before Contract */}
          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer border-red-200" onClick={() => document.getElementById('payments-before-contract')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payments Antes de Contract
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{exceptions.paymentsBeforeContract.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                paymentDate &lt; contractDate
              </p>
            </CardContent>
          </Card>

          {/* ASSUMED Payments Before Transfer */}
          <Card className="shadow-elegant hover:shadow-elegant-lg transition-shadow cursor-pointer border-red-200" onClick={() => document.getElementById('assumed-payments-before-transfer')?.scrollIntoView({ behavior: 'smooth' })}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ASSUMED Payments Antes Transfer
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{exceptions.assumedPaymentsBeforeTransfer.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                paymentDate &lt; transferDate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tables */}
        <div className="space-y-8">
          {/* Missing Required Fields */}
          {exceptions.missingRequiredFields.count > 0 && (
            <Card id="missing-required" className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-red-600" />
                  Campos Obrigatórios Faltando ({exceptions.missingRequiredFields.count})
                </CardTitle>
                <CardDescription>
                  Contratos sem contractPrice, costBasis, contractDate, originType ou saleType
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Buyer Name</TableHead>
                      <TableHead>Missing Fields</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.missingRequiredFields.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.propertyId}</TableCell>
                        <TableCell>{item.buyerName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.missingFields.map((field: string) => (
                              <Badge key={field} variant="destructive">{field}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setLocation(`/contracts/${item.id}`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* CFD Missing Installment */}
          {exceptions.cfdMissingInstallment.count > 0 && (
            <Card id="cfd-missing" className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-600" />
                  CFD sem Dados de Parcela ({exceptions.cfdMissingInstallment.count})
                </CardTitle>
                <CardDescription>
                  Contratos CFD sem installmentAmount ou installmentCount
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Buyer Name</TableHead>
                      <TableHead>Missing Fields</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.cfdMissingInstallment.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.propertyId}</TableCell>
                        <TableCell>{item.buyerName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.missingFields.map((field: string) => (
                              <Badge key={field} variant="destructive">{field}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setLocation(`/contracts/${item.id}`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ASSUMED Missing Data */}
          {exceptions.assumedMissingData.count > 0 && (
            <Card id="assumed-missing" className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  ASSUMED sem Dados ({exceptions.assumedMissingData.count})
                </CardTitle>
                <CardDescription>
                  Contratos ASSUMED sem transferDate ou installmentsPaidByTransfer (W)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Buyer Name</TableHead>
                      <TableHead>Missing Fields</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.assumedMissingData.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.propertyId}</TableCell>
                        <TableCell>{item.buyerName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.missingFields.map((field: string) => (
                              <Badge key={field} variant="destructive">{field}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setLocation(`/contracts/${item.id}`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Balloon Missing Date */}
          {exceptions.balloonMissingDate.count > 0 && (
            <Card id="balloon-missing" className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Balloon sem Data ({exceptions.balloonMissingDate.count})
                </CardTitle>
                <CardDescription>
                  Contratos com balloonAmount &gt; 0 mas sem balloonDate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Buyer Name</TableHead>
                      <TableHead>Balloon Amount</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.balloonMissingDate.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.propertyId}</TableCell>
                        <TableCell>{item.buyerName}</TableCell>
                        <TableCell>{item.balloonAmount}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setLocation(`/contracts/${item.id}`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Payments Before Contract */}
          {exceptions.paymentsBeforeContract.count > 0 && (
            <Card id="payments-before-contract" className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Payments Antes de Contract ({exceptions.paymentsBeforeContract.count})
                </CardTitle>
                <CardDescription>
                  Payments com paymentDate anterior ao contractDate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Contract Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.paymentsBeforeContract.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.propertyId}</TableCell>
                        <TableCell>{new Date(item.paymentDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(item.contractDate).toLocaleDateString()}</TableCell>
                        <TableCell>${parseFloat(item.amountTotal).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setLocation(`/payments?contractId=${item.contractId}`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Ver Payments
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ASSUMED Payments Before Transfer */}
          {exceptions.assumedPaymentsBeforeTransfer.count > 0 && (
            <Card id="assumed-payments-before-transfer" className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  ASSUMED Payments Antes Transfer ({exceptions.assumedPaymentsBeforeTransfer.count})
                </CardTitle>
                <CardDescription>
                  Payments de contratos ASSUMED com paymentDate anterior ao transferDate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property ID</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Transfer Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.assumedPaymentsBeforeTransfer.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.propertyId}</TableCell>
                        <TableCell>{new Date(item.paymentDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(item.transferDate).toLocaleDateString()}</TableCell>
                        <TableCell>${parseFloat(item.amountTotal).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setLocation(`/payments?contractId=${item.contractId}`)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Ver Payments
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
