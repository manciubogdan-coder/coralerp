import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description?: string;
}

/**
 * Pagină placeholder pentru module în curs de migrare.
 * Va fi înlocuită cu conținut real în prompturile următoare.
 */
const PlaceholderPage: React.FC<PlaceholderProps> = ({ title, description }) => {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-amber-100 text-amber-700">
              <Construction className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Modul în construcție — va fi populat în pașii următori.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlaceholderPage;
