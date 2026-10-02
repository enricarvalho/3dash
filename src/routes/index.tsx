import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
      ? { next: s.next }
      : {},


  head: () => ({
    meta: [
      { title: "Entrar · 3D Create Gestão" },
      {
        name: "description",
        content:
          "Acesse o painel de gestão da 3D Create: estoque, clientes, peças, orçamentos e financeiro.",
      },
      { property: "og:title", content: "Entrar · 3D Create Gestão" },
      {
        property: "og:description",
        content: "Painel interno da 3D Create — impressão 3D em Goiânia.",
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
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-gradient p-12 text-brand-foreground lg:flex">
        <Logo size={52} className="ring-1 ring-white/30" />
        <div>
          <h1 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            Toda a operação da 3D Create em um só painel.
          </h1>
          <p className="mt-4 max-w-md text-sm opacity-90">
            Estoque de filamentos, clientes, peças produzidas, orçamentos, fluxo de caixa e
            relatórios — com a clareza que o dia a dia da impressão 3D exige.
          </p>
        </div>
        <p className="text-xs opacity-75">Goiânia · GO</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={40} />
            <span className="text-lg font-extrabold">3D Create</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Acessar o sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use seu e-mail e senha.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field id="email" label="E-mail" type="email" value={email} onChange={setEmail} />
            <Field id="senha" label="Senha" type="password" value={password} onChange={setPassword} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
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
