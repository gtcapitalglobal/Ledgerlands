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


## V2.0 - CASH SALES & DOCUMENT UPLOAD

### Database Schema Updates
- [x] Adicionar campo `state` (string) ao schema de contracts
- [x] Adicionar campo `origin_type` (DIRECT/ASSUMED) ao schema - renomear `type` atual
- [x] Adicionar campo `sale_type` (CFD/CASH) ao schema
- [x] Adicionar campo `close_date` (date, opcional) ao schema
- [x] Tornar campos opcionais para CASH: installment_amount, installment_count, balloon_amount, balloon_date
- [x] Criar tabela `contract_attachments` (id, contract_id, file_name, file_url, file_type, uploaded_at)
- [x] Executar migration do banco de dados

### Backend - CASH Sales Logic
- [ ] Atualizar helpers para calcular profit de CASH: gain = sale_price - cost_basis (100% no ano)
- [ ] Atualizar cálculo de receivable balance: CASH = 0 sempre
- [ ] Auto-gerar payment quando criar contrato CASH (1 payment = sale_price no close_date)
- [ ] Atualizar routers tRPC para suportar sale_type CFD/CASH
- [ ] Atualizar tax schedule para incluir CASH sales

### Backend - Document Upload
- [ ] Criar procedures tRPC para upload de documentos (usando S3)
- [ ] Criar procedures tRPC para listar documentos de um contrato
- [ ] Criar procedure tRPC para deletar documento

### Frontend - Dynamic Year Filters
- [ ] Gerar lista de anos automaticamente a partir de contract_date, payment_date, close_date
- [ ] Adicionar opção "Year Range" (ex: 2025-2026)
- [ ] Adicionar opção "All years"
- [ ] Atualizar Dashboard para suportar year range e all years
- [ ] Atualizar Tax Schedule para suportar year range e all years

### Frontend - CASH Sales Support
- [ ] Atualizar Dashboard KPIs para incluir CASH sales
- [ ] Atualizar filtros para incluir sale_type (CFD/CASH/All)
- [ ] Atualizar Contracts Master para exibir sale_type
- [ ] Atualizar Contract Detail para exibir campos de CASH (close_date)
- [ ] Atualizar formulários para suportar criação de CASH sales

### Frontend - Document Upload
- [ ] Adicionar seção "Documents" na página Contract Detail
- [ ] Implementar upload de arquivos (PDF, JPG, PNG)
- [ ] Exibir lista de documentos com preview/download
- [ ] Adicionar botão para deletar documento

### Data & Templates
- [ ] Atualizar seed data para incluir 1-2 contratos CASH
- [ ] Atualizar template CSV de contracts com novos campos
- [ ] Atualizar documentação com explicação de CASH sales

### Testing
- [ ] Atualizar testes vitest para CASH sales
- [ ] Criar testes para document upload
- [ ] Validar cálculos de profit para CASH


## V2.0 - IMPLEMENTATION (FINAL APPROVED PLAN)

### Schema Migration (Attachments Enhancement)
- [x] Add propertyId to contractAttachments table
- [x] Add docType enum to contractAttachments table
- [x] Add uploadedBy to contractAttachments table

### Backend - Helpers & Utils
- [x] Create shared/utils.ts with normalizePropertyId function
- [ ] Update db.ts: createContract with Model 1 logic (openingReceivable = contractPrice for DIRECT+CFD)
- [x] Update db.ts: calculateReceivableBalance with ASSUMED payment filter (paymentDate >= transferDate)
- [x] Add db.ts: getContractByPropertyId helper
- [ ] Add storage.ts: storageDelete function for S3 cleanup
- [ ] Add db.ts: getContractAttachmentById helper
- [x] CASH: createContract auto-payment logic
- [x] CASH: calculateReceivableBalance returns 0
- [x] CASH: tax schedule 100% gain recognition
- [ ] Update db.ts: createContractAttachment with new fields (propertyId, docType, uploadedBy)

### ### Backend - Routers
- [x] Update routers.ts: contracts.create with originType, saleType, state, closeDate
- [ ] Update routers.ts: contracts.update with new fields
- [x] Update routers.ts: contracts.importCSV with CSV parsing and validation
- [x] Apply ASSUMED filter in dashboard KPIs
- [x] Apply ASSUMED filter in tax scheduleASH auto-payment safeguards
- [ ] Update routers.ts: contracts.update with new fields
- [ ] Update routers.ts: dashboard.getKPIs with reportingMode (BOOK/TAX)
- [ ] Update routers.ts: dashboard.getKPIs with BOOK mode KPIs (Contract Revenue Opened)
- [ ] Update routers.ts: taxSchedule.getByYear with ASSUMED payment filter
- [ ] Update routers.ts: contracts.attachments.delete with S3 cleanup
- [ ] Add routers.ts: dashboard.getAvailableYears procedure

### Frontend - Dashboard
- [ ] Add reportingMode state (BOOK/TAX) with toggle
- [ ] Implement BOOK mode KPI set (show Contract Revenue Opened, hide Gain Recognized)
- [ ] Implement TAX mode KPI set (show Gain Recognized)
- [ ] Update year filter with dynamic labels (YTD vs Selected Period)
- [ ] Add saleType filter (All/CFD/CASH)
- [ ] Update all type references from type → originType/saleType

### Frontend - Contracts & Detail
- [ ] Update Contracts Master table with originType and saleType columns
- [ ] Update Contract Detail with new fields (state, closeDate, originType, saleType)
- [ ] Add propertyId normalization on blur in forms
- [ ] Add docType selector in attachment upload dialog
- [ ] Update attachments list with docType badge, uploadedBy, uploadedAt

### Frontend - Year Filters
- [ ] Create useAvailableYears hook
- [ ] Implement year range selector (from/to)
- [ ] Add "All Years" option
- [ ] Update KPI labels based on yearMode

### CSV Import/Export
- [ ] Add propertyId normalization in CSV parser
- [ ] Add duplicate detection after normalization
- [ ] Update validation: ASSUMED requires transferDate + openingReceivable
- [ ] Update validation: DIRECT must have blank transferDate + openingReceivable
- [ ] Update CSV export with new fields

### Testing
- [ ] Test Model 1 receivable calculation (DIRECT = contractPrice)
- [x] Test ASSUMED payment filtering (paymentDate >= transferDate)
- [x] Test BOOK vs TAX reporting modes (manual)
- [x] Test CASH receivable = 0
- [x] Test CASH gain calculation
- [ ] Test attachment delete (DB + S3)
- [ ] Test propertyId normalization
- [ ] Test duplicate prevention
- [x] Update existing vitest tests for new schema


## V1.8 - Frontend UI (MVP Final)

### Contracts CSV Import UI
- [x] Add Import CSV button to Contracts page
- [x] Create CSV file picker and parser
- [x] Display validation errors with row numbers
- [x] Show success/failure summary
- [x] Refresh contracts list after import

### Attachments UI (Contract Detail)
- [x] Add Attachments section to Contract Detail page
- [x] Create upload button with file picker
- [x] Add docType dropdown selector (defaults to Other)
- [x] Display attachments list with docType badges
- [x] Add open/download button for each attachment
- [x] Add delete button with confirmation
- [x] Refresh attachments list after upload/delete


## UX Improvements
- [x] Fix DashboardLayout navigation menu (Dashboard, Contratos, Pagamentos, Tax Schedule, Documentação)

- [x] Make KPI cards clickable with smart navigation (Contratos Ativos → /contracts?status=active, etc.)


## Bug Fixes
- [x] Fix "Novo Contrato" button not working in Contracts page (sem onClick handler)
- [x] Adicionar botão "Editar" na página Contract Detail
- [x] Verificar por que botão "Deletar" não aparece na tabela de contratos (foi implementado mas usuário não vê)


## CRUD Completo - Implementação Total

### Contratos (Contracts)
- [x] Criar novo contrato (modal form com validação)
- [x] Editar contrato existente (modal form)
- [x] Deletar contrato (com confirmação)
- [x] Importar CSV de contratos
- [ ] Exportar CSV de contratos

### Pagamentos (Payments)
- [x] Criar novo pagamento manual (modal form)
- [x] Editar pagamento existente (modal form)
- [x] Deletar pagamento (com confirmação)
- [x] Importar CSV de pagamentos
- [x] Exportar CSV de pagamentos (botão já existe)

### Tax Schedule
- [x] Exportar CSV do Tax Schedule (botão já existe)

### Attachments
- [x] Upload de documentos
- [x] Deletar documentos
- [x] Adicionar selector de docType no upload (Contract/Notice/Deed/Assignment/Other)
- [x] Melhorar confirmação de delete

### Configurações/Settings
- [ ] Configurar anos fiscais disponíveis
- [ ] Configurar status personalizados de contratos
- [ ] Configurar counties padrão (dropdown)


## Backup e Validação (Prioridade Alta)
- [x] Implementar backup manual completo (botão Download Backup)
- [x] Criar tRPC procedure para gerar backup JSON (contratos + pagamentos + attachments metadata)
- [x] Adicionar validação de CSV com preview antes de importar contratos
- [x] Mostrar erros de validação (campos obrigatórios, formatos incorretos, datas inválidas)
- [x] Permitir correção de erros antes de confirmar import


## Bugs Ativos
- [x] CSV import ainda não funciona - CORRIGIDO com logging e error handling

## Restore Backup (Prioridade Alta)
- [x] Criar tRPC procedure backup.restore para restaurar dados do JSON
- [x] Criar página Settings com upload de arquivo JSON
- [x] Implementar validação do formato do backup antes de restaurar
- [x] Adicionar confirmação antes de sobrescrever dados existentes
- [x] Adicionar link Settings na navegação


## Export Contracts CSV
- [x] Criar tRPC procedure contracts.exportCSV para gerar CSV de contratos
- [x] Adicionar botão "Exportar CSV" na página Contracts (header)
- [x] Implementar download automático do arquivo CSV


## Tax/Audit Subledger Transformation
### 1. Contract Evidence
- [x] Add costBasisSource ENUM(HUD,PSA,ASSIGNMENT,LEGACY,OTHER) to contracts table
- [x] Add costBasisNotes TEXT to contracts table
- [x] Add openingReceivableSource ENUM(ASSIGNMENT,LEGACY,OTHER) to contracts table (ASSUMED only)
- [x] UI: show fields in create/edit forms
- [x] Validation: require Contract attachment for all, Assignment/Notice for ASSUMED

### 2. Critical Audit Log
- [x] Create tax_audit_log table (entityType, entityId, field, oldValue, newValue, changedBy, changedAt, reason NOT NULL)
- [x] Track Contract fields: contractPrice, costBasis, downPayment, openingReceivable, transferDate, closeDate
- [x] Track Payment fields: paymentDate, amountTotal, principalAmount, lateFeeAmount
- [x] Backend: audit log helpers (logContractChange, logPaymentChange, getAuditLogForContract)
- [x] Integrate audit log in contracts.update mutation (auto-capture with reason required)
- [x] Integrate audit log in payments.update mutation (auto-capture with reason required)
- [x] UI: Contract Detail "History" tab/modal showing tax_audit_log (newest first)

### 3. Period Tax Reporting
- [x] Backend: taxSchedule.getByPeriod with period ENUM(YEAR,Q1,Q2,Q3,Q4,RANGE)
- [x] TaxSchedule UI: period selector dropdown
- [x] CSV export: include period in filename (e.g., tax_schedule_2026_Q1.csv) and scope data to period

### 4. Blocking Exceptions View
- [x] Create Exceptions page listing validation failures
- [x] Rules: costBasis NULL, ASSUMED missing transferDate/openingReceivable, receivable<0, principal+lateFee!=total, CASH missing closeDate, missing docs
- [x] UI: list with deep-links to fix each issue
- [x] Backend: validation procedure returning all exceptions


## GT Lands Branding (Identidade Visual)
- [x] Copiar logo GT Lands para client/public/
- [x] Atualizar CSS variables no index.css com paleta GT Lands (verde #2F4F4F + dourado #B8956A)
- [x] Adicionar logo no DashboardLayout sidebar header
- [x] Aplicar cores GT Lands em cards, badges, botões (via CSS variables)
- [x] Ajustar contraste para acessibilidade
- [ ] Atualizar VITE_APP_LOGO env variable (opcional)


## Final Audit Log + Period Reporting (Tax/Audit Annex Only)
- [x] contracts.update: require input.reason when tracked fields change
- [x] contracts.update: auto-diff old vs new and insert tax_audit_log rows
- [x] payments.update: already has reason field (DONE)
- [x] Verify History UI works end-to-end in ContractDetail
- [x] taxSchedule.exportCSV: add procedure with period params
- [x] TaxSchedule UI: add RANGE date inputs (start/end)
- [x] CSV filename includes period (e.g., tax_schedule_2026_Q1.csv or tax_schedule_RANGE_2026-01-01_2026-03-31.csv)


## Payments CSV Import (property_id mapping)
- [x] Add getContractByPropertyId helper to db.ts (already existed)
- [x] Add normalizePropertyId helper to db.ts
- [x] Create payments.importCSV procedure with property_id→contract_id mapping
- [x] Accept headers: payment_date,(contract_id|property_id),amount_total,principal_amount,late_fee_amount,received_by,(channel?),memo
- [x] Default channel to "OTHER" if missing
- [x] Validate contract exists, error "unknown property_id" if not found
- [x] UI import CSV already exists in Payments page, updated to use importCSV mutation


## Bugs Ativos
- [x] Payments import: "Unknown property_id: 17" mesmo com contrato #17 existente (CORRIGIDO: getContractByPropertyId agora tenta com e sem # prefix)
- [x] Attachment upload: usuário fez upload de PDF no contrato #31 mas documento não aparece na lista (RESOLVIDO: implementar Drive folder link em vez de upload)

## Drive Folder Link Feature
- [x] Adicionar campo documentFolderLink (TEXT) no schema contracts
- [x] Adicionar campo no formulário de criar contrato
- [x] Adicionar campo no formulário de editar contrato
- [x] Adicionar botão "Open Drive Folder" no Contract Detail

## Dashboard Property Filter
- [x] Adicionar campo de filtro Property ID na seção Filtros do Dashboard
- [x] Atualizar backend dashboard.getKPIs para aceitar propertyId filter
- [x] Recalcular KPIs apenas para o contrato selecionado quando filtro ativo

## ASSUMED Contract Fix (downPayment = 0)
- [x] Backend: Forçar downPayment="0" em contracts.create quando originType=ASSUMED
- [x] Backend: Forçar downPayment="0" em contracts.update quando originType=ASSUMED
- [x] UI: Desabilitar campo downPayment no formulário de criar contrato quando ASSUMED
- [x] UI: Desabilitar campo downPayment no formulário de editar contrato quando ASSUMED
- [x] Verificar cálculo calculateReceivableBalance: ASSUMED usa openingReceivable - principal_filtered (sem downPayment)
- [x] Verificar que payments são filtrados por paymentDate >= transferDate para ASSUMED

## ASSUMED Fix - Comprehensive Verification
- [x] CSV Import: Verificar se downPayment=0 é forçado para ASSUMED
- [x] Dashboard KPIs: Verificar se usa filtered payments (paymentDate >= transferDate) para ASSUMED
- [x] Tax Schedule: Verificar se usa filtered payments para ASSUMED
- [x] Todos os cálculos: Garantir que downPayment não é usado em nenhum lugar para ASSUMED

## ASSUMED Full Verification Pass (Real Data)
- [x] 1. Confirmar downPayment=0 em contracts.create (ler código)
- [x] 2. Confirmar downPayment=0 em contracts.update (ler código)
- [x] 3. Confirmar downPayment=0 em contracts.importCSV (ler código)
- [x] 4. Confirmar downPayment NÃO usado em calculateReceivableBalance (ler código)
- [x] 5. Confirmar downPayment NÃO usado em dashboard.getKPIs (ler código)
- [x] 6. Confirmar downPayment NÃO usado em taxSchedule.getByPeriod (ler código)
- [x] 7. Confirmar downPayment NÃO usado em taxSchedule.exportCSV (ler código)
- [x] 8. Confirmar filtro paymentDate >= transferDate em calculateReceivableBalance
- [x] 9. Confirmar filtro paymentDate >= transferDate em dashboard.getKPIs
- [x] 10. Confirmar filtro paymentDate >= transferDate em taxSchedule.getByPeriod
- [x] 11. Confirmar filtro paymentDate >= transferDate em taxSchedule.getByYear
- [x] 12. Criar teste de regressão ASSUMED com payments antes/depois de transferDate
- [x] 13. Bug encontrado e corrigido: Dashboard KPIs não filtrava payments por transferDate para principalReceivedYTD/lateFeesYTD

## CRITICAL BUG: downPayment Regression (DIRECT contracts)
- [x] Investigar: downPayment sendo zerado para DIRECT (CÓDIGO ESTÁ CORRETO - preserva DIRECT, zera ASSUMED)
- [x] Verificar contracts.create: Lógica correta (linha 88)
- [x] Verificar contracts.update: Lógica correta (linha 135-137)
- [x] Verificar contracts.importCSV: Lógica correta (linha 105)
- [x] Adicionar teste de regressão: DIRECT com downPayment=4000 deve permanecer 4000 após update
- [x] Adicionar teste de regressão: ASSUMED com downPayment=4000 deve virar 0 após create/update
- [x] Adicionar teste de regressão: CSV import preserva DIRECT, força ASSUMED a 0

## 🚨 EMERGÊNCIA: Recuperar downPayments zerados
- [x] Verificar banco de dados: 3 contratos DIRECT encontrados
- [x] Usuário confirmou: 8 contratos DIRECT originais
- [x] Usuário forneceu CSVs com dados corretos (contracts_*.csv)
- [x] Extrair downPayments dos CSVs
- [x] Criar script de restauração SQL
- [x] Executar UPDATE para restaurar downPayments
- [x] Verificar restauração: 8 contratos com downPayments corretos ($10,249 total)

## Down Payment End-to-End Fix (No Data Loss, No Double Count)
- [x] 1. REMOVER forcing downPayment=0 em contracts.create (server/routers.ts)
- [x] 2. REMOVER forcing downPayment=0 em contracts.update (server/routers.ts)
- [x] 3. RE-HABILITAR campo downPayment para ASSUMED na UI (Contracts.tsx)
- [x] 4. RE-HABILITAR campo downPayment para ASSUMED na UI (ContractDetail.tsx)
- [x] 5. REMOVER texto "always 0 for ASSUMED" da UI
- [x] 6. CRIAR helper computeEffectiveDownPayment (detecta DP em payments via memo)
- [x] 7. ATUALIZAR helper parseDecimal (normaliza vírgula/ponto)
- [x] 8. ATUALIZAR calculateReceivableBalance para usar effective DP
- [x] 9. ATUALIZAR dashboard.getKPIs para incluir effective DP no período correto (principalReceivedYTD + gainRecognizedYTD)
- [ ] 10. ATUALIZAR taxSchedule.getByPeriod para incluir effective DP
- [ ] 11. SUBSTITUIR parseFloat por parseDecimal nos cálculos
- [ ] 12. ATUALIZAR testes de regressão (downpayment + assumed)
- [ ] 13. VALIDAR com contrato #25 (receivable=13021, gainRecognized correto)

## PATCH TAX Annex (Complete)
- [x] 1. parseDecimal já handle "23.664,00" (EU) e "23,664.00" (US)
- [ ] 2. TaxSchedule.getByPeriod: parseDecimal + effective DP + CASH logic
- [ ] 3. TaxSchedule.getByYear: parseDecimal + effective DP + CASH logic
- [ ] 4. Replace parseFloat → parseDecimal em server/db.ts
- [ ] 5. Replace parseFloat → parseDecimal em server/routers.ts
- [ ] 6. Replace parseFloat → parseDecimal em server/contractsImport.ts
- [ ] 7. Replace parseFloat → parseDecimal em client formatCurrency
- [ ] 8. Period filter fix: [start, endExclusive) onde endExclusive = endDate + 1 day
- [ ] 9. Backfill script: dryRun report (inferir DP perdidos)
- [ ] 10. Backfill script: apply com audit log
- [ ] 11. Validar contrato #25 DIRECT: principal=6643, gain=3451.19, receivable=13021


## Data Cleanup + Reimport from Excel
- [x] 1. Analisar estrutura do arquivo GT_Lands_Contracts_Ledger_FULL_FINAL.xlsx (8 contratos: 6 ASSUMED + 2 DIRECT)
- [x] 2. Criar script de limpeza: DELETE ALL contracts + payments
- [x] 3. Criar script de importação do Excel para banco (import_excel_to_db.py)
- [x] 4. Executar limpeza do banco (DELETE FROM payments; DELETE FROM contracts;)
- [x] 5. Executar importação do Excel (8/8 contratos: 3 DIRECT + 5 ASSUMED)
- [x] 6. Validar dados importados (#17, #22, #25, #31, #33, #35, #43, #45)


## Quick Payment Feature ("Marcar como Pago")
- [x] 1. Criar backend endpoint payments.quickPay (cria payment com installmentAmount)
- [x] 2. Adicionar botão "Marcar como Pago" na página Contract Detail
- [x] 3. Verificar que Receivable Balance está visível no Dashboard (card "Saldo a Receber" - $71,774)
- [x] 4. Verificar que Receivable Balance está visível na página Contract Detail (card com formatCurrency)
- [x] 5. Testar funcionalidade completa (marcar como pago → saldo atualiza) - Testado com contrato #25, funcionando perfeitamente


## Seller Financing Export Standards (Audit + Tax Ready)
- [x] Backend: Create contractsSubledger.exportCSV procedure
- [x] Backend: Create contractsSubledger.exportExcel procedure  
- [x] Backend: Update taxSchedule.exportCSV with GT_Lands naming convention
- [x] Frontend: Create Contracts Subledger page with period selector
- [x] Frontend: Update Tax Schedule to use backend export with GT_Lands naming
- [x] Add Contracts Subledger to navigation menu
- [x] Test exports and verify naming conventions (Annual 2026 tested successfully for both modules)


## Cash Flow Projection (Implementação Atual)
- [x] Backend: Create cashFlowProjection.get12Months procedure
- [x] Backend: Calculate expected payments based on installment amounts
- [x] Backend: Include balloon payments in projection
- [x] Frontend: Create Cash Flow Projection page with chart
- [x] Frontend: Add monthly breakdown table
- [x] Frontend: Add card on Dashboard showing next 3 months projection
- [x] Add Cash Flow Projection to navigation menu

## Future Features (Anotado para Implementação Futura)

### Document Generation (Prioridade #14)
- [ ] Generate payment receipts automatically
- [ ] Generate year-end statements for buyers
- [ ] Generate tax forms
- [ ] Customizable templates with logo
- [ ] PDF export via email or download

### Stripe Integration (Prioridade #16)
- [ ] Setup Stripe account integration
- [ ] Create payment links for buyers
- [ ] Automatic reconciliation with contracts
- [ ] Payment confirmation emails
- [ ] Track payment methods and fees

### Google Drive Auto-Backup (Prioridade #18)
- [ ] Setup Google Drive API integration
- [ ] Daily automatic backup of all data
- [ ] Organize exports by date in Drive folders
- [ ] Backup contracts, payments, and attachments
- [ ] Disaster recovery documentation


## Delete All Contracts and Payments (Settings Page)
- [x] Backend: Create system.deleteAllData procedure
- [x] Backend: Delete all payments first (foreign key constraint)
- [x] Backend: Delete all contracts
- [x] Frontend: Add "Danger Zone" section in Settings page
- [x] Frontend: Add "Delete All Data" button with red warning styling
- [x] Frontend: Implement double confirmation dialog (type "DELETE ALL" to confirm)
- [x] Test deletion and verify UI works correctly (visual test - dialog opens, confirmation required)


## Financial Summary (Paridade 100% com Planilha) - COMPLETO ✅
- [x] Backend: Adicionar financialSummary ao contracts.getById
- [x] Backend: Calcular paidInstallments (contagem de payments)
- [x] Backend: Calcular cashReceivedTotal (down payment + sum of payments)
- [x] Backend: Calcular financedAmount (contractPrice - downPayment)
- [x] Backend: Incluir openingReceivable e receivableBalance
- [x] Frontend: Criar seção Financial Summary no Contract Detail
- [x] Frontend: Exibir Parcelas Pagas (X de Y)
- [x] Frontend: Exibir Total Recebido (incluindo down payment)
- [x] Frontend: Exibir Valor Financiado
- [x] Frontend: Exibir Opening Receivable (ASSUMED) ou Receivable Balance (DIRECT)
- [x] Testar com contrato #25 real (ASSUMED)
- [x] Validar paridade com planilha


## Balloon Payment Validation (Contrato #25)
- [x] Adicionar balloon payment de $3,500 em 11/11/2025 ao contrato #25
- [x] Validar que receivable balance atualiza para $11,774 - CORRETO!
- [x] Verificar que Financial Summary mostra 10 parcelas pagas (9 regulares + 1 balloon) - CORRETO!
- [x] Verificar que Total Recebido mostra $11,541 ($4,000 down + $4,041 regular + $3,500 balloon) - CORRETO!
- [x] Sistema validado: todos os cálculos batem com a metodologia GT Lands 2025


## ROI/IRR Implementation (Investment Performance Analysis)
- [ ] Backend: Create calculateROI helper in db.ts (Gross Profit / Cost Basis × 100)
- [ ] Backend: Create calculateIRR helper in db.ts (using XIRR formula with payment dates)
- [ ] Backend: Add ROI and IRR to contracts.getById response
- [ ] Backend: Create dashboard.getPortfolioROI procedure (weighted average)
- [ ] Backend: Create performance.getRanking procedure (all contracts sorted by IRR)
- [ ] Frontend: Add ROI card to Contract Detail Key Metrics
- [ ] Frontend: Add IRR card to Contract Detail Key Metrics
- [ ] Frontend: Add "ROI Médio" card to Dashboard
- [ ] Frontend: Create Performance Ranking page with sortable table
- [ ] Frontend: Add Performance Ranking to navigation menu
- [ ] Test ROI calculation with contract #25 (expected: ~108%)
- [ ] Test IRR calculation with contract #25 (expected: ~15-20% annualized)


## ROI/IRR Implementation (Investment Performance Analysis)
- [x] Backend: Add calculateROI function to db.ts (Gross Profit / Cost Basis × 100)
- [x] Backend: Add calculateIRR function to db.ts (XIRR using Newton's method)
- [x] Backend: Add portfolioROI to dashboard.getKPIs (weighted average)
- [x] Backend: Add roi and irr to contracts.getById financialSummary
- [x] Frontend: Add "ROI do Portfolio" card to Dashboard
- [x] Frontend: Add ROI and IRR cards to Contract Detail page
- [x] Test: Verify Dashboard shows correct portfolio ROI (126.31%) - CORRETO!
- [x] Test: Verify Contract Detail shows correct individual ROI (108.13%) and IRR (51.52%) - CORRETO!


## 5 Fixes Críticos (Baseado em Planilhasemtítulo(3).xlsx)

### Fix 1: Alinhar Status Enum no Formulário de Criação
- [x] client/src/pages/Contracts.tsx: Atualizar formulário de criação para usar exatamente "Active" | "PaidOff" | "Default" | "Repossessed"
- [x] Remover/evitar "active/paid_off/defaulted" (snake_case)
- [x] Atualizar default do state para esses enums

### Fix 2: Trocar Fetch por tRPC no Dashboard Backup
- [x] client/src/pages/Dashboard.tsx: Remover fetch('/api/trpc/backup.downloadAll')
- [x] Usar trpc.backup.downloadAll (query enabled:false + refetch ou mutation)
- [x] Manter geração de arquivo JSON e download com Blob

### Fix 3: Corrigir Filtros do Dashboard
- [x] Deduplicar Property IDs no select (usar Set + filter(Boolean))
- [x] Corrigir link de "Contratos Ativos" para usar status "Active"
- [x] Proteger cálculo de margem contra divisão por zero (NaN/Infinity)

### Fix 4: Aplicar Filtros via Querystring em Contracts
- [x] client/src/pages/Contracts.tsx: Ler query params (?status=..., ?type=...)
- [x] Setar os filtros ao carregar/alterar rota

### Fix 5: Aplicar Patch do Tax Schedule
- [x] server/routers.ts: Ajustar taxSchedule.getByPeriod para incluir down payment corretamente
- [x] server/routers.ts: Ajustar taxSchedule.getByYear para incluir down payment corretamente
- [x] Tratar CASH com closeDate conforme patch TAX_SCHEDULE_PATCH.md

### Testing
- [x] Rodar `pnpm build` e verificar erros TypeScript
- [x] Rodar `pnpm typecheck` e verificar erros
- [x] Criar checkpoint final

## 2 Ajustes Finais (Fix 6 e Fix 7)

### Fix 6: Corrigir Status Enum no Contract Detail
- [x] client/src/pages/ContractDetail.tsx: Trocar status values de "active/paid_off/defaulted" para "Active" | "PaidOff" | "Default" | "Repossessed"
- [x] Atualizar SelectItem values para usar os mesmos enums do backend
- [x] Garantir que o update mutation envia os valores corretos

### Fix 7: Aplicar Lógica do Tax Schedule ao exportCSV
- [x] server/routers.ts: taxSchedule.exportCSV deve usar mesma lógica do getByPeriod
- [x] Implementar endExclusive = endDate + 1 dia
- [x] ASSUMED: filtrar payments por transferDate
- [x] Down Payment: incluir automaticamente quando não há payment de DP (DIRECT+CFD, contractDate no período)
- [x] CASH: reconhecer 100% no closeDate (ou zerar se fora do período)
- [x] CFD: gainRecognized = principalReceived × grossProfitPercent
- [x] Garantir que CSV exportado bate 1:1 com getByPeriod

### Testing
- [x] Rodar typecheck
- [x] Rodar build
- [x] Criar checkpoint final

## Fix 8: Dashboard Backup e County Filter

### Backup Data Validation
- [x] client/src/pages/Dashboard.tsx: Validar result.data após refetch() no backup
- [x] Abortar download se data for undefined/null
- [x] Mostrar toast.error("No backup data") ao usuário

### County Filter Fix
- [x] client/src/pages/Dashboard.tsx: Deduplicar counties usando Set
- [x] Remover valores vazios/undefined com filter(Boolean)
- [x] Ordenar counties alfabeticamente

## P0 + P2 Improvements

### P0.1: Dashboard Profit by Year
- [ ] Backend: Criar endpoint dashboard.getProfitByYear (TAX + BOOK modes)
- [ ] Backend: Calcular gainRecognized, lateFees, totalProfit por ano
- [ ] Frontend: Adicionar gráfico "Profit by Year" (3-5 anos)
- [ ] Frontend: Adicionar cards: Total Profit, Gain Recognized, Late Fees (Selected Year)

### P0.2: Contract Validations
- [ ] Backend: Zod schema - exigir campos mínimos (contractPrice, costBasis, contractDate, originType, saleType)
- [ ] Backend: Zod schema - CFD requer installmentAmount + installmentCount
- [ ] Backend: Zod schema - ASSUMED requer transferDate + installmentsPaidByTransfer
- [ ] Backend: Zod schema - balloonAmount > 0 requer balloonDate
- [ ] Frontend: Atualizar Contracts.tsx com mensagens de validação
- [ ] Frontend: Atualizar ContractDetail.tsx com mensagens de validação

### P0.3: Exceptions Page (QC Automático)
- [ ] Backend: Criar endpoint exceptions.list
- [ ] Backend: Detectar missing required fields
- [ ] Backend: Detectar CFD missing installment data
- [ ] Backend: Detectar ASSUMED missing transferDate/W
- [ ] Backend: Detectar balloon missing date
- [ ] Backend: Detectar payments antes de contractDate
- [ ] Backend: Detectar ASSUMED payments antes de transferDate
- [ ] Frontend: Criar página Exceptions.tsx
- [ ] Frontend: Exibir cards com contagens de exceções
- [ ] Frontend: Tabelas clicáveis com links para contracts/payments

### P2.7: Centralizar Enums
- [ ] Criar shared/enums.ts com status, originType, saleType
- [ ] Atualizar backend para usar enums centralizados
- [ ] Atualizar frontend para usar enums centralizados
- [ ] Atualizar zod schemas para usar enums centralizados


## P0 + P2 Improvements (COMPLETED)

### P2.7: Centralizar Enums
- [x] shared/enums.ts: Criar arquivo com enums centralizados (status, originType, saleType)
- [x] Atualizar front e back para importar desses enums
- [x] Usar zod.enum com essas listas

### P0.1: Dashboard Profit por Ano
- [x] Backend: dashboard.getProfitByYear endpoint (TAX + BOOK mode)
- [x] Frontend: Gráfico de colunas + cards (Total Profit, Gain Recognized, Late Fees)
- [x] Suportar filtros (status, originType, county, propertyId)

### P0.2: Validações no Create/Edit Contract
- [x] Backend: Zod schema validations (campos obrigatórios, CFD, ASSUMED, balloon)
- [x] Backend: Adicionar campo installmentsPaidByTransfer (W) ao schema
- [x] Frontend: Mensagens claras no form (via tRPC errors)

### P0.3: Exceptions Page (QC Automático)
- [x] Backend: exceptions.list endpoint
- [x] Frontend: Exceptions.tsx com cards + tabelas clicáveis
- [x] 6 categorias: Missing Required, CFD Missing, ASSUMED Missing, Balloon Missing, Payments Before Contract, ASSUMED Payments Before Transfer

### Testing
- [x] Rodar build/typecheck (0 erros)
- [x] Rodar testes (30/30 passando)
- [x] Criar checkpoint final


## Ajustes Finais (Final Polish)

### 1. Campo W (installmentsPaidByTransfer) no Fluxo ASSUMED
- [x] client/src/pages/Contracts.tsx: adicionar campo numérico "Installments Paid Before Transfer (W)" visível quando originType="ASSUMED"
- [x] Enviar installmentsPaidByTransfer no payload do form
- [x] server/routers.ts (contracts.importCSV): incluir installmentsPaidByTransfer no schema
- [x] server/contractsImport.ts: aceitar installmentsPaidByTransfer e validar ASSUMED exige transferDate + openingReceivable + installmentsPaidByTransfer
- [x] contracts.exportCSV: incluir coluna installmentsPaidByTransfer

### 2. Correção dashboard.getProfitByYear
- [x] Calcular years apenas de (contracts filtrados + payments desses contracts), não de allPayments global
- [x] CASH logic: se closeYear==year => principalReceived=contractPrice, gainRecognized=contractPrice-costBasis, lateFees=0; senão => tudo 0
- [x] Garantir que Profit by Year no Dashboard continua funcionando com os mesmos filtros

### Testing
- [x] Rodar typecheck (0 erros)
- [x] Rodar build
- [x] Criar checkpoint final


## CPA-Proof Improvements (Final Polish)

### 1. Backend Validation ASSUMED
- [x] server/routers.ts (contracts.create): quando originType="ASSUMED" exigir openingReceivable > 0
- [x] server/routers.ts (contracts.update): quando originType="ASSUMED" exigir openingReceivable > 0
- [x] Mensagens de erro claras

### 2. UI Edit Contract Detail
- [x] client/src/pages/ContractDetail.tsx: adicionar campos ASSUMED ao form de edição
  - transferDate (date)
  - openingReceivable (number)
  - installmentsPaidByTransfer (W) (number)
- [x] Exibir/ocultar conforme originType
- [x] Persistir via update mutation

### 3. dashboard.getProfitByYear CASH Consistency
- [x] server/routers.ts (dashboard.getProfitByYear): para saleType="CASH"
  - se YEAR(closeDate) == year => principalReceived = contractPrice; gainRecognized = contractPrice - costBasis; lateFees = 0
  - senão => principalReceived = 0; gainRecognized = 0; lateFees = 0
- [x] Garantir que filtros (status/originType/county/propertyId) continuam aplicados

### Testing
- [x] Rodar typecheck (0 erros)
- [x] Rodar build
- [x] Criar checkpoint final


## Logo GT Lands

- [x] Fazer upload da logo LogoGTLandsPrincipal.png para o projeto
- [x] Configurar logo no DashboardLayout com link para https://www.gtlands.app/dashboard
- [x] Testar e criar checkpoint


## Melhorar Layout dos Filtros do Dashboard

- [x] Reorganizar filtros em grid horizontal compacto
- [x] Reduzir espaçamento e melhorar alinhamento
- [x] Testar responsividade e criar checkpoint


## Adicionar Balloon Date na UI

- [ ] Contract Detail: Exibir Balloon Date na seção de informações do contrato
- [ ] Contract Detail: Adicionar Balloon Date ao form de edição
- [ ] Testar e criar checkpoint


## Feature #2: Performance Ranking Dashboard

- [ ] Backend: Criar endpoint contracts.getPerformanceRanking
- [ ] Frontend: Criar página PerformanceRanking.tsx
- [ ] Adicionar rota no App.tsx e menu no DashboardLayout
- [ ] Tabela ordenada por ROI com filtros
- [ ] Gráfico de barras comparativo de ROI

## Feature #4: Square Payment Portal

- [ ] Backend: Adicionar Square SDK e credenciais via webdev_request_secrets
- [ ] Backend: Criar endpoint payments.createSquarePayment
- [ ] Frontend: Criar página PublicPayment.tsx (rota pública /pay/:contractId)
- [ ] Integrar Square Web Payments SDK
- [ ] Auto-registro de payment após pagamento bem-sucedido

## Feature #5: Cash Flow Projection Avançado

- [ ] Backend: Estender cashFlow.getProjection para 12-24 meses
- [ ] Frontend: Adicionar gráfico de linha no CashFlowProjection.tsx
- [ ] Backend: Criar endpoint cashFlow.exportExcel
- [ ] Frontend: Botão "Export to Excel" na página Cash Flow Projection


## New Features (Feb 2026)

### Feature #2: Performance Ranking Dashboard
- [x] Backend: contracts.getPerformanceRanking endpoint
- [x] Frontend: PerformanceRanking.tsx page com tabela e gráfico
- [x] Filtros por Status, County, Origin Type
- [x] Adicionar rota no App.tsx e menu no DashboardLayout

### Feature #5: Cash Flow Projection Avançado
- [x] Backend: cashFlowProjection.get24Months endpoint
- [x] Backend: cashFlowProjection.exportExcel endpoint
- [x] Frontend: Gráfico de linha 12-24 meses
- [x] Frontend: Botão "Export to Excel"

### Feature #4: Square Payment Portal (COMPLETO)
- [x] Adicionar Square credentials como secrets
- [x] Validar credenciais Square via teste
- [x] Instalar square SDK no backend
- [x] Backend: payments.createSquarePayment endpoint
- [x] Frontend: PaymentPortal.tsx page com Square Web SDK
- [x] Adicionar payment links no Contract Detail (botão "Copiar Link de Pagamento")
- [x] Rota /pay/:contractId adicionada


## Dashboard Filters Visual Redesign

- [x] Redesenhar filtros do Dashboard para layout mais compacto e moderno
- [x] Melhorar alinhamento e espaçamento
- [x] Aplicar cores GT Lands (verde/dourado)
- [x] Testar e criar checkpoint

## Installment Schedule System (Auto-generation)
- [ ] Add firstInstallmentDate field to contracts schema
- [ ] Create installments table (contractId, installmentNumber, dueDate, amount, status, paidDate, paymentId)
- [ ] Implement auto-generation of installments on contract create/update
- [ ] Create Installments page showing all installments with status (Pending/Overdue/Paid)
- [ ] Add "Mark as Paid" button to record payment and link to payment record
- [ ] Update Dashboard to show overdue installments count
- [ ] Migrate existing contracts data to use firstInstallmentDate from spreadsheet

## Critical Bug Fixes (Priority 1)
- [x] Fix contracts.getById: apply ASSUMED payment scope filter + use computeEffectiveDownPayment
- [x] Fix contracts.getById: exclude DP payment from paidInstallments count
- [x] Fix contracts.getById: correct cashReceivedTotal calculation
- [x] Fix calculateIRR: prevent down payment double-counting
- [x] Fix ContractDetail: invalidate getById cache on quickPay and updateContract
- [x] Fix Dashboard: prevent division by zero in margin calculation
- [x] Add Dashboard KPI: Total Profit Recognized YTD (gain + late fees)

## Pre-Deed Tie-Out Report (12-31-2025)
- [x] Parse backup JSON file (contracts + payments)
- [x] Filter payments with paymentDate <= 12/31/2025
- [x] Apply ASSUMED filter (paymentDate >= transferDate)
- [x] Detect Down Payment (memo or contract.downPayment field)
- [x] Calculate Down Payment vs Installments received
- [x] Add deedRecordedDate field to contracts schema + migration
- [x] Expose deedRecordedDate in Contracts list UI
- [x] Expose deedRecordedDate in Contract Detail (editable)
- [x] Classify Pre-Deed status (Confirmed/Missing based on deedRecordedDate)
- [x] Generate Excel report with Summary + Missing section
- [x] Generate PDF for CPA (Pre-Deed only + totals)

## Pre-Deed Tie-Out Report Generator (In-App)
- [x] Add deedStatus ENUM ("UNKNOWN" | "NOT_RECORDED" | "RECORDED") to contracts schema
- [x] Update Contract UI with conditional deedRecordedDate field based on deedStatus
- [x] Create reports.preDeedTieOut tRPC endpoint with cutoff date parameter
- [x] Implement calculation logic (Down Payment + Installments through cutoff)
- [x] Apply Pre-Deed classification rules (Y/N/Missing based on deedStatus)
- [x] Create PDF export with formatted table and totals
- [x] Create CSV export with all rows
- [x] Add "Pre-Deed Tie-Out" dropdown to Dashboard with quick actions (12/31/2025, 12/31/2026, Custom)
- [x] Test report generation for 2025 and 2026

## CPA-Hardening Improvements
- [x] Add deedStatus and deedRecordedDate columns to contracts.exportCSV
- [x] Add deedStatus and deedRecordedDate parsing to contracts.importCSV
- [x] Add validation in import: RECORDED requires date, NOT_RECORDED must have null date
- [x] Add backend zod validation in contracts.create for deed fields
- [x] Add backend zod validation in contracts.update for deed fields
- [x] Replace alert() with toast in PreDeedTieOutButton component

## CSV Export RFC4180 Compliance
- [x] Create server/utils/csv.ts with csvEscape() and toCSV() functions
- [x] Apply CSV utility to contracts.exportCSV
- [x] Apply CSV utility to payments.exportCSV
- [x] Apply CSV utility to taxSchedule.exportCSV
- [x] Apply CSV utility to reports.preDeedTieOut CSV export
- [x] Apply CSV utility to contractsSubledger.exportCSV
- [ ] Test CSV exports with special characters (commas, quotes, newlines)

## Add Contract Date to Edit Form
- [x] Add Contract Date field to ContractDetail edit form
- [x] Add contractDate to backend update schema validation
- [x] Test editing Contract Date for DIRECT and ASSUMED contracts

## Fix Deed Validation Error
- [x] Fix backend validation: when deedStatus=NOT_RECORDED, allow null deedRecordedDate
- [x] Test saving contract with deedStatus=NOT_RECORDED and empty date

## Fix Frontend Deed Date Submission
- [x] Fix ContractDetail to send empty string "" instead of null for deedRecordedDate
- [x] Fix backend to handle empty string and convert to null
- [x] Test saving contract with empty deedRecordedDate field


## Bug Fixes - February 2026
- [x] Fix validation bug: Allow saving contracts with deedStatus="NOT_RECORDED" without requiring deedRecordedDate
- [x] Fix frontend bug: balloonDate initialization using proper ISO date format
- [x] Fix bug: documentFolderLink not being saved when editing contracts
- [x] Correct contract date for property #25 from May 9, 2024 to May 12, 2025
- [x] Standardize all date formats across entire system to mm/dd/yyyy format
- [x] Correct all contract dates to match spreadsheet (8 contracts with date discrepancies)
- [x] Enhance contracts CSV export: ISO dates (MM-DD-YYYY), operational columns, calculated fields, proper null handling
- [x] Redesign Pre-Deed Tie-Out report to match professional CPA format with entity header, purpose statement, receipt dates column, and CPA note
- [x] Fix critical bug: Select.Item components with empty values breaking application
- [x] Extract contract data from spreadsheet and update Pre-Deed status
- [x] Generate all installments including balloon payments
- [x] Mark past-due installments as paid based on current date
- [x] Fix Property ID filter in Installments page not showing results
- [x] Add 6 KPI summary cards to Installments page: total count, balloon count, paid count, pending count, total paid amount, total receivable amount
- [x] Replace Property ID text input with dropdown select in Installments page
