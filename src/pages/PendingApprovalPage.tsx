import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut } from 'lucide-react';

const PendingApprovalPage: React.FC = () => {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-amber-100 rounded-full">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">În așteptarea aprobării</CardTitle>
          <CardDescription>
            Contul tău este în curs de aprobare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Email:</strong> {profile?.email}
            </p>
            {profile?.name && (
              <p className="text-sm text-muted-foreground">
                <strong>Nume:</strong> {profile.name}
              </p>
            )}
          </div>
          <p className="text-sm text-center text-muted-foreground">
            Un administrator va aproba contul tău în curând. 
            Vei putea accesa aplicația după aprobare.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Deconectare
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApprovalPage;
