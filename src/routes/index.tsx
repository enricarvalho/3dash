import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Boxes, ChartNoAxesCombined, ClipboardCheck } from "lucide-react";


export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
      ? { next: s.next }
      : {},


  head: () => ({
    meta: [
      { title: "Acesso · Painel operacional" },
      {
        name: "description",
        content:
          "Acesse o painel operacional para gerenciar estoque, clientes, produção e financeiro.",
      },
      { property: "og:title", content: "Acesso · Painel operacional" },
      {
        property: "og:description",
        content: "Ambiente seguro de gestão operacional.",
      },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const goAfterAuth = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/dashboard", replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goAfterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);


  const submit = async () => {
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) throw error;
      toast.success("Bem-vindo de volta!");
      goAfterAuth();

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand-gradient p-12 text-brand-foreground lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <Logo size={42} className="bg-brand-foreground text-brand" />
          <span className="font-display text-sm font-bold uppercase">Painel operacional</span>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-5 font-display text-xs font-bold uppercase text-brand">Controle central</p>
          <h1 className="font-display text-5xl font-bold leading-[1.08] xl:text-6xl">
            Produção, vendas e caixa sob controle.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-brand-foreground/70">
            Um ambiente direto para acompanhar a operação e tomar decisões com dados claros.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-brand-foreground/15 bg-brand-foreground/15">
            {[
              [Boxes, "Estoque"],
              [ClipboardCheck, "Produção"],
              [ChartNoAxesCombined, "Financeiro"],
            ].map(([Icon, label]) => (
              <div key={label as string} className="bg-brand-foreground/5 p-4">
                <Icon className="h-5 w-5 text-brand" />
                <p className="mt-3 text-xs font-semibold">{label as string}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-brand-foreground/50">Ambiente interno e seguro</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={40} />
            <span className="font-display text-base font-bold">Painel operacional</span>
          </div>
          <p className="mb-3 font-display text-xs font-bold uppercase text-primary">Área restrita</p>
          <h2 className="font-display text-3xl font-bold">Acessar o sistema</h2>
          <p className="mt-2 text-sm text-muted-foreground">Entre com suas credenciais de acesso.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field id="email" label="E-mail" type="email" value={email} onChange={setEmail} />
            <Field id="senha" label="Senha" type="password" value={password} onChange={setPassword} />
            <Button type="submit" className="mt-2 w-full" disabled={loading}>
              {loading ? "Entrando..." : <>Entrar <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Apenas administradores podem criar novos usuários.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
