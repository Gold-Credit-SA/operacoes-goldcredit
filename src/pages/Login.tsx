import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import logoGoldCredit from '@/assets/logo-gold-credit.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || '/consulta';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: 'Erro ao fazer login',
        description: 'E-mail ou senha inválidos. Verifique suas credenciais.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    toast({
      title: 'Bem-vindo!',
      description: 'Login realizado com sucesso.',
    });

    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-black relative overflow-hidden items-center justify-center">
        {/* Subtle gold accent lines */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div
            className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-[0.03]"
            style={{ background: 'radial-gradient(circle, hsl(38 67% 67%) 0%, transparent 70%)' }}
          />
          <div
            className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-[0.03]"
            style={{ background: 'radial-gradient(circle, hsl(38 67% 67%) 0%, transparent 70%)' }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-16 max-w-lg">
          <img src={logoGoldCredit} alt="Gold Credit" className="h-20 mb-12" />
          <div className="w-12 h-px bg-primary/40 mb-8" />
          <p className="text-white/50 text-sm tracking-[0.2em] uppercase font-light">
            Plataforma de Gestão
          </p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center lg:hidden mb-12">
            <img src={logoGoldCredit} alt="Gold Credit" className="h-14" />
          </div>

          <div className="mb-10">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Acesso ao sistema
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Entre com suas credenciais para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-11 bg-transparent border-border/60 focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-11 bg-transparent border-border/60 focus:border-primary transition-colors"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-2 font-medium tracking-wide"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <p className="mt-10 text-center text-xs text-muted-foreground/60">
            Não tem acesso? Entre em contato com o administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
