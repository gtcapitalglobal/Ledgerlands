import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileText, DollarSign, Calendar, TrendingUp, Upload, Download } from "lucide-react";

export default function Documentation() {
  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Documentação</h1>
          <p className="text-muted-foreground mt-2">
            Guia completo de uso do Land Contract Dashboard
          </p>
        </div>

        {/* Overview */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Visão Geral
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              O <strong>Land Contract Dashboard</strong> é um sistema completo de gestão de contratos de financiamento imobiliário (Contract for Deed) com foco em cálculo de lucro reconhecido para fins fiscais.
            </p>
            <p>
              Este sistema funciona como <strong>source of truth</strong> para timing de reconhecimento de lucro fiscal, enquanto o Wave Books utiliza Model 1 (revenue reconhecido na execução do contrato).
            </p>
          </CardContent>
        </Card>

        {/* Business Model */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Modelo de Negócio</CardTitle>
            <CardDescription>Como funcionam os contratos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Contract for Deed</h3>
              <p className="text-sm text-muted-foreground">
                Venda de terreno com posse imediata ao comprador, mas a deed (escritura) só é transferida após o pagamento final.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Tipos de Contrato</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10 mt-1">DIRECT</Badge>
                  <div>
                    <p className="font-medium">GT Real sold</p>
                    <p className="text-sm text-muted-foreground">
                      Contrato criado e vendido diretamente pela GT Real
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-accent/10 text-accent-foreground hover:bg-accent/10 mt-1">ASSUMED</Badge>
                  <div>
                    <p className="font-medium">G&T legacy</p>
                    <p className="text-sm text-muted-foreground">
                      Contrato existente antes da GT Real, transferido via non-cash contribution. Suporta "Legacy Received Payments" (pagamentos recebidos antes da transferência).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Split de Pagamentos</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Principal:</strong> Down payment, installments, balloon payment</p>
                <p><strong>Late Fee:</strong> Diferença acima do installment padrão, reconhecido como 100% income</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Calculations */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Cálculos Fiscais (Installment Sale Method)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div>
                <p className="font-mono text-sm font-semibold">Gross Profit = Contract Price − Cost Basis</p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold">Gross Profit % = Gross Profit / Contract Price</p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold">Gain Recognized = Principal Received × Gross Profit %</p>
              </div>
              <div>
                <p className="font-mono text-sm font-semibold">Late Fees = 100% income no ano recebido</p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>DIRECT contracts:</strong> Wave reconhece contract price como income na data de assinatura (JE: Dr Notes Receivable / Cr Land Sales – Installment). Pagamentos apenas reduzem Notes Receivable.
              </p>
              <p>
                <strong>ASSUMED contracts:</strong> Notes Receivable inicial = principal restante na data de transferência. Pagamentos antes da transferência não são pagamentos da GT Real.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Funcionalidades Principais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Dashboard
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Visão geral com KPIs: contratos ativos, preço total, custo base, lucro bruto, receivable balance, principal recebido YTD, gain recognized YTD, late fees YTD.
              </p>
              <p className="text-sm text-muted-foreground">
                Filtros por: ano, status, tipo (DIRECT/ASSUMED), county
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Contracts Master
              </h3>
              <p className="text-sm text-muted-foreground">
                Tabela completa de contratos com filtros, busca e navegação para página de detalhes. Clique em qualquer contrato para ver informações completas, histórico de pagamentos e cálculos.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Payments Ledger
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Registro de todos os pagamentos com data, property #, valores, split principal/late fee, received-by, channel e notas.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4" />
                <span className="text-muted-foreground">Import bulk via CSV</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Download className="h-4 w-4" />
                <span className="text-muted-foreground">Export payments ledger</span>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Tax Profit Schedule
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Schedule fiscal anual com seletor de ano. Tabela por contrato mostrando: principal recebido, gross profit %, gain recognized, late fees, total profit recognized.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Download className="h-4 w-4" />
                <span className="text-muted-foreground">Export CSV do schedule anual</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CSV Templates */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Templates CSV</CardTitle>
            <CardDescription>Formatos para import de dados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Contracts CSV</h3>
              <div className="bg-muted/50 p-3 rounded font-mono text-xs overflow-x-auto">
                <pre>
property_id,buyer_name,type,county,contract_date,contract_price,cost_basis,down_payment,installment_amount,installment_count,status
                </pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Payments CSV</h3>
              <div className="bg-muted/50 p-3 rounded font-mono text-xs overflow-x-auto">
                <pre>
property_id,payment_date,amount_total,principal_amount,late_fee_amount,received_by,channel,memo
                </pre>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>received_by:</strong> GT_REAL_BANK | LEGACY_G&T | PERSONAL | UNKNOWN
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>channel:</strong> ZELLE | ACH | CASH | CHECK | WIRE | OTHER
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Helper Features */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Helpers Automáticos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm mb-1">Split Automático de Late Fee</h3>
              <p className="text-sm text-muted-foreground">
                Se <code>amount_total &gt; installment_amount</code>, o sistema auto-sugere <code>late_fee = diferença</code>
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1">Cálculo de Receivable Balance</h3>
              <p className="text-sm text-muted-foreground">
                <strong>DIRECT:</strong> Contract Price - Down Payment - Sum(Principal Payments)
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>ASSUMED:</strong> Opening Receivable - Sum(Principal Payments após transfer date)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="shadow-elegant bg-muted/30">
          <CardHeader>
            <CardTitle>Suporte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Para dúvidas ou suporte, entre em contato com o administrador do sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
