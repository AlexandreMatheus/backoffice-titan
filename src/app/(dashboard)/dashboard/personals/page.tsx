import { PersonalApprovalTable } from '@/components/personal-approval-table';

export const metadata = {
  title: 'Personais pendentes — Atlas Backoffice',
};

export default function PersonalsPendingPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Liberação de personais</h1>
        <p className="text-muted-foreground">
          Cadastros com status pendente aguardam validação do CREF e aprovação manual para uso da
          plataforma.
        </p>
      </div>
      <PersonalApprovalTable />
    </div>
  );
}
