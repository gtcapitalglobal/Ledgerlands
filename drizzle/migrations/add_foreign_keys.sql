-- Add foreign key constraints to ensure data integrity
-- Migration: Add Foreign Keys (2026-02-11)

-- Add FK for payments.contractId
ALTER TABLE payments 
ADD CONSTRAINT fk_payments_contract 
FOREIGN KEY (contractId) REFERENCES contracts(id) 
ON DELETE CASCADE;

-- Add FK for installments.contractId
ALTER TABLE installments 
ADD CONSTRAINT fk_installments_contract 
FOREIGN KEY (contractId) REFERENCES contracts(id) 
ON DELETE CASCADE;

-- Add FK for installments.paymentId (nullable, so no CASCADE needed)
ALTER TABLE installments 
ADD CONSTRAINT fk_installments_payment 
FOREIGN KEY (paymentId) REFERENCES payments(id) 
ON DELETE SET NULL;

-- Add FK for contractAttachments.contractId
ALTER TABLE contractAttachments 
ADD CONSTRAINT fk_attachments_contract 
FOREIGN KEY (contractId) REFERENCES contracts(id) 
ON DELETE CASCADE;

-- Add FK for taxAuditLog.entityId (polymorphic, so we can't add FK directly)
-- Note: taxAuditLog uses entityType + entityId pattern, so FK would require separate columns
-- Skipping FK for taxAuditLog as it's polymorphic

-- Add indexes for better query performance
CREATE INDEX idx_payments_contractId ON payments(contractId);
CREATE INDEX idx_payments_propertyId ON payments(propertyId);
CREATE INDEX idx_payments_paymentDate ON payments(paymentDate);

CREATE INDEX idx_installments_contractId ON installments(contractId);
CREATE INDEX idx_installments_propertyId ON installments(propertyId);
CREATE INDEX idx_installments_dueDate ON installments(dueDate);
CREATE INDEX idx_installments_paymentId ON installments(paymentId);

CREATE INDEX idx_attachments_contractId ON contractAttachments(contractId);
CREATE INDEX idx_attachments_propertyId ON contractAttachments(propertyId);

CREATE INDEX idx_audit_entity ON taxAuditLog(entityType, entityId);
CREATE INDEX idx_audit_changedAt ON taxAuditLog(changedAt);
