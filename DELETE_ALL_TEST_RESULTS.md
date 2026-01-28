# Delete All Data - Test Results

## Test Date: 2026-01-27

### ✅ Settings Page - Danger Zone

**Location:** /settings (Configurações)
**Result:** SUCCESS

**UI Elements:**
- ✅ "Zona de Perigo" section with red border (border-red-200)
- ✅ Red title "Zona de Perigo" (text-red-600)
- ✅ Warning alert with AlertTriangle icon
- ✅ Full-width red button "Deletar Todos os Contratos e Pagamentos"
- ✅ Clear description: "Remove permanentemente todos os contratos e pagamentos do banco de dados"

---

### ✅ Confirmation Dialog (Double Confirmation)

**Trigger:** Click "Deletar Todos os Contratos e Pagamentos" button
**Result:** SUCCESS

**Dialog Content:**
- ✅ Title: "⚠️ Deletar Todos os Dados" (red text)
- ✅ Subtitle: "Esta ação é PERMANENTE e IRREVERSÍVEL"
- ✅ Red alert box with detailed warning:
  - "VOCÊ ESTÁ PRESTES A DELETAR:"
  - Bullet list: contratos, pagamentos, histórico financeiro
  - Bold text: "Esta ação NÃO PODE ser desfeita!"

**Confirmation Mechanism:**
- ✅ Text input field with label "Digite 'DELETE ALL' para confirmar:"
- ✅ Placeholder: "DELETE ALL"
- ✅ Font-mono styling for clarity
- ✅ Recommendation: "💡 Recomendamos fazer um backup (botão 'Download Backup' no Dashboard) antes de continuar"

**Buttons:**
- ✅ "Cancelar" (outline variant) - closes dialog without action
- ✅ "Deletar Tudo Permanentemente" (destructive variant)
- ✅ Button disabled until user types exactly "DELETE ALL"
- ✅ Loading state: "Deletando..." when mutation is pending

---

## Backend Implementation

**Procedure:** `trpc.system.deleteAllData`
**Access:** protectedProcedure (requires authentication)

**Logic:**
1. Fetch all payments and contracts to count them
2. Delete all payments first (respects foreign key constraint)
3. Delete all contracts
4. Return success message with deletion counts

**Response:**
```typescript
{
  success: true,
  message: 'All contracts and payments deleted successfully',
  deleted: {
    payments: number,
    contracts: number
  }
}
```

---

## Safety Features

✅ **Double Confirmation:**
- User must click button in Danger Zone
- User must type exact text "DELETE ALL" in dialog

✅ **Visual Warnings:**
- Red color scheme throughout
- Multiple warning icons (AlertTriangle)
- Bold text emphasizing permanence

✅ **User Guidance:**
- Recommendation to download backup first
- Clear description of what will be deleted
- Explicit statement that action cannot be undone

✅ **Post-Deletion:**
- Success toast shows deletion counts
- Page automatically reloads to show empty state
- Dialog closes and confirmation text resets

---

## Test Scenario (NOT EXECUTED - Visual Test Only)

**If user proceeds with deletion:**
1. User clicks "Deletar Todos os Contratos e Pagamentos"
2. Dialog opens with warnings
3. User types "DELETE ALL" in input field
4. "Deletar Tudo Permanentemente" button becomes enabled
5. User clicks button
6. Backend deletes all payments (e.g., 3 payments)
7. Backend deletes all contracts (e.g., 8 contracts)
8. Toast: "Todos os dados deletados! 8 contratos, 3 pagamentos"
9. Page reloads
10. Dashboard shows empty state (0 contracts, $0 values)

---

## Integration Summary

### Backend (server/_core/systemRouter.ts):
- New procedure: `deleteAllData` (protectedProcedure)
- Uses existing db functions: `getAllPayments()`, `getAllContracts()`, `deletePayment()`, `deleteContract()`
- Returns deletion counts for user feedback

### Frontend (client/src/pages/Settings.tsx):
- New state: `isDeleteDialogOpen`, `deleteConfirmText`
- New mutation: `trpc.system.deleteAllData.useMutation()`
- New handler: `handleDeleteAll()` validates confirmation text
- Success callback: shows toast + reloads page
- Error callback: shows error toast

### UI Components:
- Danger Zone card with red styling
- Confirmation dialog with destructive alerts
- Text input for manual confirmation
- Disabled button until confirmation matches

---

## Security Considerations

✅ **Authentication Required:** protectedProcedure ensures only logged-in users can delete
✅ **No Accidental Clicks:** Two-step process (button + typed confirmation)
✅ **Visual Feedback:** Red colors and warning icons throughout
✅ **Audit Trail:** Deletion counts returned and displayed in toast

---

## Future Enhancements (Optional):

1. **Backup Enforcement:** Require user to download backup before allowing deletion
2. **Admin-Only:** Restrict to admin role (currently any authenticated user can delete)
3. **Soft Delete:** Add "deleted_at" timestamp instead of permanent deletion
4. **Deletion Log:** Record who deleted data and when in separate audit table
