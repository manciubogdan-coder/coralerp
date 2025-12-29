import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.string().email('Email invalid');
const passwordSchema = z.string().min(6, 'Parola trebuie să aibă minim 6 caractere');
const nameSchema = z.string().min(2, 'Numele trebuie să aibă minim 2 caractere');

const AuthPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, signUp, user, isApproved, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && isApproved) {
      navigate('/');
    }
  }, [user, isApproved, navigate]);

  const validateLogin = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      emailSchema.parse(loginEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.loginEmail = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(loginPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.loginPassword = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      nameSchema.parse(signupName);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.signupName = e.errors[0].message;
      }
    }
    
    try {
      emailSchema.parse(signupEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.signupEmail = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(signupPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.signupPassword = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateLogin()) return;
    
    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);
    
    if (error) {
      toast({
        title: 'Eroare la autentificare',
        description: error.message === 'Invalid login credentials' 
          ? 'Email sau parolă incorectă' 
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignup()) return;
    
    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setIsLoading(false);
    
    if (error) {
      let message = error.message;
      if (error.message.includes('already registered')) {
        message = 'Acest email este deja înregistrat';
      }
      toast({
        title: 'Eroare la înregistrare',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Cont creat cu succes',
        description: 'Contul tău așteaptă aprobarea unui administrator.',
      });
      setSignupEmail('');
      setSignupPassword('');
      setSignupName('');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Package className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Inventory Manager</CardTitle>
          <CardDescription>
            Autentifică-te pentru a accesa aplicația
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Autentificare</TabsTrigger>
              <TabsTrigger value="signup">Înregistrare</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="email@exemplu.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.loginEmail && (
                    <p className="text-sm text-destructive">{errors.loginEmail}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Parolă</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.loginPassword && (
                    <p className="text-sm text-destructive">{errors.loginPassword}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Se autentifică...
                    </>
                  ) : (
                    'Autentificare'
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nume</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Numele tău"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.signupName && (
                    <p className="text-sm text-destructive">{errors.signupName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="email@exemplu.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.signupEmail && (
                    <p className="text-sm text-destructive">{errors.signupEmail}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Parolă</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Minim 6 caractere"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.signupPassword && (
                    <p className="text-sm text-destructive">{errors.signupPassword}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Se creează contul...
                    </>
                  ) : (
                    'Creează cont'
                  )}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Contul va trebui aprobat de un administrator
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
