# Land Contract Dashboard - TODO

## Database & Backend
- [x] Criar schema de contratos (Contract) com todos os campos necessários
- [x] Criar schema de pagamentos (Payment) com split principal/late fee
- [x] Implementar helpers de banco de dados para queries
- [x] Criar tRPC procedures para CRUD de contratos
- [x] Criar tRPC procedures para CRUD de pagamentos
- [x] Implementar cálculos: Gross Profit %, Gain Recognized, Receivable Balance
- [x] Implementar lógica para contratos ASSUMED com Legacy Received Payments
- [ ] Criar procedure para import CSV de contratos
- [x] Criar procedure para import CSV de pagamentos
- [x] Criar procedure para export CSV de payments ledger
- [x] Criar procedure para export CSV de tax schedule

## Frontend - Design & Layout
- [x] Definir paleta de cores elegante e tema visual
- [x] Configurar tipografia e espaçamento global
- [x] Criar DashboardLayout com navegação lateral
- [ ] Implementar tema escuro/claro (opcional)

## Frontend - Dashboard
- [x] Criar página Dashboard com KPI cards
- [x] Implementar filtros (ano, status, tipo, county)
- [x] Calcular e exibir KPIs: contratos ativos, total contract price, total cost basis
- [x] Calcular e exibir KPIs: total gross profit, total receivable balance
- [x] Calcular e exibir KPIs: principal received YTD, gain recognized YTD, late fees YTD

## Frontend - Contracts Master
- [x] Criar página Contracts Master com tabela
- [x] Implementar filtros e busca
- [x] Implementar navegação para página de detalhes ao clicar
- [x] Adicionar botão para criar novo contrato
- [ ] Criar formulário de criação/edição de contrato

## Frontend - Contract Detail
- [x] Criar página de detalhes do contrato
- [x] Exibir todos os campos do contrato
- [x] Exibir histórico de pagamentos
- [x] Exibir saldo a receber (receivable balance)
- [x] Exibir valores calculados: gross profit %, principal received (year), gain recognized (year)
- [x] Adicionar botão para editar contrato
- [x] Adicionar botão para adicionar pagamento

## Frontend - Payments Ledger
- [x] Criar página Payments Ledger com tabela de todos os pagamentos
- [x] Exibir colunas: data, property #, amount, principal vs late fee split, received-by, notes
- [ ] Implementar helper automático para split: se amount_total > installment_amount, sugerir late_fee
- [ ] Criar formulário para adicionar pagamento manual
- [x] Implementar upload e import bulk CSV de pagamentos
- [x] Implementar validação de CSV com relatório de erros

## Frontend - Tax Profit Schedule
- [x] Criar página Tax Profit Schedule
- [x] Implementar seletor de ano (2025, 2026, etc.)
- [x] Criar tabela por contrato com: principal received, gross profit %, gain recognized, late fees, total profit recognized
- [x] Implementar exportação CSV do schedule

## Data & Documentation
- [x] Criar seed data demo: 2 contratos DIRECT + 2 contratos ASSUMED
- [x] Criar seed data demo: pagamentos para os 4 contratos
- [x] Criar página "How to use" com documentação
- [x] Criar templates CSV para download (Contracts e Payments)

## Testing
- [x] Escrever testes vitest para cálculos de Gross Profit %
- [x] Escrever testes vitest para cálculos de Gain Recognized
- [x] Escrever testes vitest para import CSV
- [x] Escrever testes vitest para validação de dados
