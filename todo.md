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
