import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, AlertTriangle, CheckCircle } from "lucide-react";
import { formatDateTime } from "@/lib/dateUtils";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export default function Settings() {
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupData, setBackupData] = useState<any>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [clearExisting, setClearExisting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const restoreMutation = trpc.backup.restore.useMutation({
    onSuccess: (result) => {
      toast.success(`Backup restaurado! ${result.contractsImported} contratos, ${result.paymentsImported} pagamentos`);
      setBackupFile(null);
      setBackupData(null);
      setIsConfirmOpen(false);
      setClearExisting(false);
    },
    onError: (error) => {
      toast.error(`Erro ao restaurar: ${error.message}`);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Por favor, selecione um arquivo JSON de backup');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate backup format
      if (!data.contracts || !data.payments || !data.exportedAt) {
        toast.error('Formato de backup inválido');
        return;
      }

      setBackupFile(file);
      setBackupData(data);
      toast.success(`Backup válido: ${data.contracts.length} contratos, ${data.payments.length} pagamentos`);
    } catch (error) {
      toast.error('Erro ao ler arquivo JSON');
      console.error(error);
    }

    e.target.value = '';
  };

  const handleRestore = () => {
    if (!backupData) return;
    setIsConfirmOpen(true);
  };

  const confirmRestore = () => {
    if (!backupData) return;

    restoreMutation.mutate({
      contracts: backupData.contracts,
      payments: backupData.payments,
      clearExisting,
    });
  };

  const deleteAllMutation = trpc.system.deleteAllData.useMutation({
    onSuccess: (result) => {
      toast.success(`Todos os dados deletados! ${result.deleted.contracts} contratos, ${result.deleted.payments} pagamentos`);
      setIsDeleteDialogOpen(false);
      setDeleteConfirmText('');
      // Refresh page to show empty state
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`Erro ao deletar: ${error.message}`);
    },
  });

  const handleDeleteAll = () => {
    if (deleteConfirmText !== 'DELETE ALL') {
      toast.error('Digite "DELETE ALL" para confirmar');
      return;
    }
    deleteAllMutation.mutate();
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-2">
            Gerenciar backup e restauração de dados
          </p>
        </div>

        {/* Restore Backup Section */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Restaurar Backup</CardTitle>
            <CardDescription>
              Faça upload de um arquivo JSON de backup para restaurar contratos e pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Restaurar um backup pode sobrescrever dados existentes. 
                Recomendamos fazer um backup atual antes de restaurar.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="backup-file">Selecionar Arquivo de Backup (JSON)</Label>
              <Input
                id="backup-file"
                type="file"
                accept=".json"
                onChange={handleFileSelect}
              />
            </div>

            {backupData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-semibold text-green-800">Backup Válido</p>
                </div>
                <div className="text-sm text-green-700">
                  <p>Arquivo: {backupFile?.name}</p>
                  <p>Data do backup: {formatDateTime(backupData.exportedAt)}</p>
                  <p>Contratos: {backupData.contracts.length}</p>
                  <p>Pagamentos: {backupData.payments.length}</p>
                  {backupData.attachments && <p>Attachments: {backupData.attachments.length}</p>}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleRestore}
                disabled={!backupData || restoreMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                {restoreMutation.isPending ? 'Restaurando...' : 'Restaurar Backup'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="shadow-elegant border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Zona de Perigo</CardTitle>
            <CardDescription>
              Ações irreversíveis que afetam todos os dados do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>ATENÇÃO:</strong> As ações abaixo são permanentes e não podem ser desfeitas.
                Certifique-se de ter um backup antes de prosseguir.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="w-full"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Deletar Todos os Contratos e Pagamentos
              </Button>
              <p className="text-sm text-muted-foreground">
                Remove permanentemente todos os contratos e pagamentos do banco de dados.
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delete All Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600">⚠️ Deletar Todos os Dados</DialogTitle>
              <DialogDescription>
                Esta ação é PERMANENTE e IRREVERSÍVEL.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>VOCÊ ESTÁ PRESTES A DELETAR:</strong>
                  <ul className="list-disc list-inside mt-2">
                    <li>Todos os contratos (DIRECT e ASSUMED)</li>
                    <li>Todos os pagamentos registrados</li>
                    <li>Todo o histórico financeiro</li>
                  </ul>
                  <p className="mt-2 font-bold">Esta ação NÃO PODE ser desfeita!</p>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm">Digite "DELETE ALL" para confirmar:</Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE ALL"
                  className="font-mono"
                />
              </div>

              <p className="text-sm text-muted-foreground">
                💡 Recomendamos fazer um backup (botão "Download Backup" no Dashboard) antes de continuar.
              </p>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteAll}
                disabled={deleteConfirmText !== 'DELETE ALL' || deleteAllMutation.isPending}
                variant="destructive"
              >
                {deleteAllMutation.isPending ? 'Deletando...' : 'Deletar Tudo Permanentemente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Dialog */}
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Restauração</DialogTitle>
              <DialogDescription>
                Você está prestes a restaurar {backupData?.contracts.length} contratos e {backupData?.payments.length} pagamentos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Esta ação não pode ser desfeita facilmente. Certifique-se de ter um backup atual antes de continuar.
                </AlertDescription>
              </Alert>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clear-existing"
                  checked={clearExisting}
                  onCheckedChange={(checked) => setClearExisting(checked as boolean)}
                />
                <label
                  htmlFor="clear-existing"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Limpar todos os dados existentes antes de restaurar
                </label>
              </div>

              <p className="text-sm text-muted-foreground">
                {clearExisting 
                  ? '⚠️ Todos os contratos e pagamentos atuais serão deletados e substituídos pelos dados do backup.'
                  : 'ℹ️ Os dados do backup serão adicionados aos dados existentes. Contratos duplicados podem causar erros.'}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmRestore}
                disabled={restoreMutation.isPending}
                variant="destructive"
              >
                {restoreMutation.isPending ? 'Restaurando...' : 'Confirmar Restauração'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
