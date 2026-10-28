import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccountLoadingError({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p role="alert" className="max-w-md text-foreground">{message}</p>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw className="mr-2 h-4 w-4" />Reîncearcă încărcarea
      </Button>
    </div>
  );
}