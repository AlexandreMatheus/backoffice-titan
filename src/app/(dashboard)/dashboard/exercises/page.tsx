import { ExerciseTable } from '@/components/exercise-table';

export const metadata = {
  title: 'Exercícios — Atlas Backoffice',
};

export default function ExercisesPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exercícios do Sistema</h1>
        <p className="text-muted-foreground">
          Gerencie os exercícios globais da plataforma Atlas (created_by IS NULL).
        </p>
      </div>
      <ExerciseTable />
    </div>
  );
}
