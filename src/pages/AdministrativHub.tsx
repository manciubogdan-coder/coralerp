import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  FileClock,
  type LucideIcon,
} from 'lucide-react';
import BackToHubButton from '@/components/BackToHubButton';

interface Tile {
  label: string;
  desc: string;
  path: string;
  icon: LucideIcon;
}

const TILES: Tile[] = [
  { label: 'Utilizatori', desc: 'Aprobare conturi și roluri pe departamente.', path: '/administrativ/users', icon: Users },
  { label: 'Audit Operații', desc: 'Istoric acțiuni utilizatori.', path: '/administrativ/audit', icon: FileClock },
];

const AdministrativHub: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Administrativ</h1>
          <p className="text-muted-foreground">Gestionare utilizatori, audit și nomenclatoare.</p>
        </div>
        <BackToHubButton />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Card
              key={t.path}
              onClick={() => navigate(t.path)}
              className="cursor-pointer hover:border-primary transition-colors"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{t.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{t.desc}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdministrativHub;
