import { useState } from "react";
import { motion } from "motion/react";
import { whatsappLink } from "@/lib/contact";
import { SmartImage } from "../SmartImage";

const field =
  "w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-white placeholder:text-white/60 outline-none transition-[border-color,box-shadow] duration-300 " +
  "focus:border-brand-purple focus:shadow-[0_0_0_3px_oklch(0.686_0.194_318.3/0.25)] " +
  "user-invalid:border-destructive user-invalid:shadow-[0_0_0_3px_oklch(0.6_0.22_25/0.2)] " +
  "user-valid:border-brand-blue/70";

export function QuoteForm() {
  const [fileName, setFileName] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const msg = [
      "Olá, 3D Create! Quero um orçamento.",
      `Nome: ${data.get("nome")}`,
      `Contato: ${data.get("contato")}`,
      `Projeto: ${data.get("projeto")}`,
      fileName ? `Referência: ${fileName} (envio o arquivo aqui)` : null,
    ]
      .filter(Boolean)
      .join("\n");
    window.open(whatsappLink(msg), "_blank", "noopener");
  }

  return (
    <section id="orcamento" className="relative isolate overflow-hidden bg-ink px-6 py-28 sm:py-36">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(90% 70% at 80% 0%, oklch(0.42 0.22 300 / 0.55) 0%, transparent 65%), radial-gradient(70% 60% at 10% 100%, oklch(0.40 0.20 265 / 0.45) 0%, transparent 65%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2 lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.02] text-white">
            Solicite seu orçamento
          </h2>
          <p className="mt-6 max-w-md leading-relaxed text-white/55">
            Conte o que você precisa. Respondemos com prazo, material e valor — normalmente no
            mesmo dia.
          </p>
          <SmartImage
            base="/images/cta-render"
            alt="Peça impressa em 3D finalizada com iluminação dramática"
            width={1280}
            height={1024}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="mt-12 hidden w-full rounded-3xl object-cover lg:block"
          />
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm"
        >
          <div>
            <label htmlFor="nome" className="text-xs uppercase tracking-[0.2em] text-white/65">
              Nome
            </label>
            <input id="nome" name="nome" required placeholder="Seu nome" className={`mt-2 ${field}`} />
          </div>
          <div>
            <label htmlFor="contato" className="text-xs uppercase tracking-[0.2em] text-white/65">
              WhatsApp ou e-mail
            </label>
            <input
              id="contato"
              name="contato"
              required
              placeholder="(62) 90000-0000"
              className={`mt-2 ${field}`}
            />
          </div>
          <div>
            <label htmlFor="projeto" className="text-xs uppercase tracking-[0.2em] text-white/65">
              Descrição do projeto
            </label>
            <textarea
              id="projeto"
              name="projeto"
              required
              rows={4}
              placeholder="O que você quer imprimir, tamanho, quantidade e prazo"
              className={`mt-2 resize-none ${field}`}
            />
          </div>
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-white/65">
              Referência (opcional)
            </span>
            <label
              htmlFor="referencia"
              className="mt-2 flex min-h-[56px] cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/50 transition-colors duration-500 hover:border-white/35"
            >
              <span className="truncate">{fileName || "Enviar imagem ou arquivo 3D"}</span>
              <span className="brand-gradient ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl leading-none text-white" aria-hidden>+</span>
            </label>
            <input
              id="referencia"
              type="file"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </div>
          <button
            type="submit"
            className="brand-gradient w-full rounded-full py-4 font-medium text-primary-foreground transition-all duration-500 hover:shadow-[0_0_50px_-6px_oklch(0.56_0.26_305/0.9)]"
          >
            Enviar pedido de orçamento
          </button>
          <p className="text-center text-xs text-white/60">
            Abrimos o WhatsApp com sua mensagem pronta — é só anexar o arquivo e enviar.
          </p>
        </motion.form>
      </div>
    </section>
  );
}