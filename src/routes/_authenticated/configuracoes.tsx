import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Logo } from "@/components/Logo";
import { PrintPreview } from "@/components/PrintPreview";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Label } from "@/components/ui/label";
import { useSaveRecord } from "@/hooks/use-crud";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · 3D Create" },
      { name: "description", content: "Dados da empresa e preferências do painel." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const save = useSaveRecord("profiles");
  const profile = useQuery({
    queryKey: ["profiles", "me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { ...data, email: auth.user.email };
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    company: "",
    contact_email: "",
    contact_phone: "",
    contact_instagram: "",
    contact_website: "",
    contact_address: "",
    pdf_footer_text: "",
    min_margin_pct: 20,
    default_printer_watts: 0,
    default_energy_price_kwh: 0,
    price_multiplier: 3,
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        full_name: profile.data.full_name ?? "",
        company: profile.data.company ?? "3D Create",
        contact_email: profile.data.contact_email ?? "",
        contact_phone: profile.data.contact_phone ?? "",
        contact_instagram: profile.data.contact_instagram ?? "",
        contact_website: profile.data.contact_website ?? "",
        contact_address: profile.data.contact_address ?? "",
        pdf_footer_text: profile.data.pdf_footer_text ?? "",
        min_margin_pct: Number(profile.data.min_margin_pct ?? 20),
        default_printer_watts: Number(profile.data.default_printer_watts ?? 0),
        default_energy_price_kwh: Number(profile.data.default_energy_price_kwh ?? 0),
        price_multiplier: Number(profile.data.price_multiplier ?? 3),
      });
    }

  }, [profile.data]);


  const submit = () => {
    if (!profile.data?.id) return;
    save.mutate(
      { id: profile.data.id, values: form },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["profiles", "me"] });
          qc.invalidateQueries({ queryKey: ["profiles", "me", "contact"] });
        },
      },
    );
  };

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  const changePassword = async () => {
    const email = profile.data?.email;
    if (!email) return;
    if (pwd.next.length < 8) return toast.error("A nova senha deve ter ao menos 8 caracteres");
    if (pwd.next !== pwd.confirm) return toast.error("A confirmação não confere");
    setSavingPwd(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: pwd.current,
      });
      if (authError) {
        toast.error("Senha atual incorreta");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) toast.error(error.message);
      else {
        toast.success("Senha alterada com sucesso");
        setPwd({ current: "", next: "", confirm: "" });
      }
    } finally {
      setSavingPwd(false);
    }
  };


  return (
    <div className="max-w-6xl">
      <PageHeader title="Configurações" description="Dados da empresa e da sua conta." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border bg-card p-5">

        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="font-semibold">{form.company || "3D Create"}</p>
            <p className="text-sm text-muted-foreground">Impressão 3D · Goiânia/GO</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Seu nome</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nome da empresa</Label>
            <Input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail de acesso</Label>
            <Input value={profile.data?.email ?? ""} disabled />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold">Dados de contato nos PDFs</h3>
          <p className="text-xs text-muted-foreground">
            Aparecem no cabeçalho dos orçamentos e relatórios exportados.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>E-mail de contato</Label>
              <Input
                type="email"
                placeholder="contato@3dcreate.com.br"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input
                placeholder="(62) 90000-0000"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Instagram</Label>
              <Input
                placeholder="@3dcreate"
                value={form.contact_instagram}
                onChange={(e) => setForm({ ...form, contact_instagram: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <Input
                placeholder="www.3dcreate.com.br"
                value={form.contact_website}
                onChange={(e) => setForm({ ...form, contact_website: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Endereço</Label>
              <Input
                placeholder="Rua Exemplo, 123 · Setor Marista · Goiânia/GO"
                value={form.contact_address}
                onChange={(e) => setForm({ ...form, contact_address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Texto do rodapé dos PDFs</Label>
              <Textarea
                rows={2}
                placeholder="Ex.: 3D Create · CNPJ 00.000.000/0001-00 · Documento sem valor fiscal"
                value={form.pdf_footer_text}
                onChange={(e) => setForm({ ...form, pdf_footer_text: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Aparece no rodapé de cada página impressa, ao lado da numeração. Deixe em branco para usar o padrão.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold">Padrões de produção e precificação</h3>
          <p className="text-xs text-muted-foreground">
            Usados automaticamente ao cadastrar uma nova peça.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Potência da impressora (W)</Label>
              <Input
                type="number"
                min={0}
                step="1"
                placeholder="350"
                value={form.default_printer_watts}
                onChange={(e) =>
                  setForm({ ...form, default_printer_watts: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço do kWh (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0,95"
                value={form.default_energy_price_kwh}
                onChange={(e) =>
                  setForm({ ...form, default_energy_price_kwh: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Multiplicador de preço sugerido</Label>
              <Input
                type="number"
                min={1}
                step="0.1"
                value={form.price_multiplier}
                onChange={(e) =>
                  setForm({ ...form, price_multiplier: Number(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Preço sugerido = custo × {form.price_multiplier || 3}.
              </p>
            </div>
          </div>
        </div>


        <div className="mt-8">
          <h3 className="text-sm font-semibold">Alerta de margem baixa</h3>
          <p className="text-xs text-muted-foreground">
            Orçamentos e vendas com margem abaixo deste percentual (ou negativa) ficam destacados na lista.
          </p>
          <div className="mt-4 max-w-xs space-y-1.5">
            <Label>Margem mínima aceitável (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.min_margin_pct}
              onChange={(e) =>
                setForm({ ...form, min_margin_pct: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={submit} disabled={save.isPending}>
            Salvar alterações
          </Button>
        </div>

        <div className="mt-8 border-t pt-6">
          <h3 className="text-sm font-semibold">Alterar senha de login</h3>
          <p className="text-xs text-muted-foreground">
            Informe a senha atual e escolha uma nova senha com pelo menos 8 caracteres.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Senha atual</Label>
              <Input
                type="password"
                autoComplete="current-password"
                value={pwd.current}
                onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={pwd.next}
                onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={pwd.confirm}
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
              />
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-4"
            onClick={changePassword}
            disabled={savingPwd || !pwd.current || !pwd.next || !pwd.confirm}
          >
            {savingPwd ? "Alterando..." : "Alterar senha"}
          </Button>
        </div>

        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <PrintPreview data={form} />
        </div>
      </div>
    </div>
  );

}

