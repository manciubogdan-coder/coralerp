import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCollaborationAlerts } from '@/contexts/CollaborationAlertsContext';
import { useEvidentaAndradaAccess } from '@/hooks/use-evidenta-andrada-access';
import { DEPARTMENTS } from '@/lib/departments';
import { ShieldAlert, MessageSquare, ListTodo, Bell, ClipboardList } from 'lucide-react';

interface CollabTile {
  label: string;
  description: string;
  rootPath: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const COLLAB_TILES: CollabTile[] = [
  {
    label: 'Chat',
    description: 'Mesaje directe, grupuri și canale de departament.',
    rootPath: '/chat',
    icon: MessageSquare,
  },
  {
    label: 'Taskuri',
    description: 'Kanban personal și de echipă, deadline-uri și recurențe.',
    rootPath: '/taskuri',
    icon: ListTodo,
  },
  {
    label: 'Reguli notificări',
    description: 'Configurează cine primește notificări la fiecare eveniment.',
    rootPath: '/administrativ/notificari-reguli',
    icon: Bell,
    adminOnly: true,
  },
];

const DepartmentHub: React.FC = () => {
  const navigate = useNavigate();
  const { hasDepartment, profile, isAdmin } = useAuth();
  const { chatUnread, taskUnread } = useCollaborationAlerts();
  const { allowed: canSeeEvidenta } = useEvidentaAndradaAccess();

  // Toate hub-urile (inclusiv Calitate și Operator) provin din DEPARTMENTS;
  // tile-ul apare doar dacă userul are rolul corespunzător (sau e admin).
  const accessible = DEPARTMENTS.filter((d) => hasDepartment(d.id));

  const collab = COLLAB_TILES.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Coral ERP</h1>
        <p className="text-muted-foreground">
          Bun venit{profile?.name ? `, ${profile.name}` : ''}. Selectează un departament pentru a începe.
        </p>
      </div>

      {accessible.length === 0 ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center text-center gap-3">
            <ShieldAlert className="h-10 w-10 text-amber-500" />
            <p className="text-lg font-medium">Nu ai încă acces la niciun departament</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Roagă un administrator să-ți atribuie cel puțin un rol din pagina
              <span className="font-mono"> /administrativ/users</span>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Departamente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessible.map((dept) => {
              const Icon = dept.icon;
              return (
                <Card
                  key={`${dept.id}-${dept.rootPath}`}
                  onClick={() => navigate(dept.rootPath)}
                  className="cursor-pointer hover:border-primary transition-colors"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="text-lg">{dept.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{dept.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
            {canSeeEvidenta && (
              <Card
                key="evidenta-andrada"
                onClick={() => navigate('/evidenta-andrada')}
                className="cursor-pointer hover:border-primary transition-colors"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      <ClipboardList className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">Evidență Andrada</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Evidență loturi pe producători: rebut, pierdere tehnologică și cântar.
                  </CardDescription>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Colaborare
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collab.map((t) => {
            const Icon = t.icon;
            const unread = t.rootPath === '/chat' ? chatUnread : t.rootPath === '/taskuri' ? taskUnread : 0;
            return (
              <Card
                key={t.rootPath}
                onClick={() => navigate(t.rootPath)}
                className="cursor-pointer hover:border-primary transition-colors"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {t.label}
                      {unread > 0 && (
                        <Badge className="bg-destructive text-destructive-foreground border-0">
                          {unread > 99 ? '99+' : unread}
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{t.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DepartmentHub;
