import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { DEPARTMENTS } from '@/lib/departments';
import { ShieldAlert } from 'lucide-react';

const DepartmentHub: React.FC = () => {
  const navigate = useNavigate();
  const { hasDepartment, profile } = useAuth();

  const accessible = DEPARTMENTS.filter((d) => hasDepartment(d.id));

  return (
    <div className="container mx-auto py-6 space-y-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessible.map((dept) => {
            const Icon = dept.icon;
            return (
              <Card
                key={dept.id}
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
        </div>
      )}
    </div>
  );
};

export default DepartmentHub;
