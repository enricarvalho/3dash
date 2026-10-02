import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { COMPANY } from "../content";

export default defineTool({
  name: "build_quote_link",
  title: "Gerar link de orçamento",
  description:
    "Gera um link de WhatsApp já preenchido com a descrição do projeto para solicitar orçamento à 3D Create. Não envia nada — apenas monta a URL.",
  inputSchema: {
    project: z.string().min(1).describe("Descrição do projeto ou peça desejada."),
    name: z.string().optional().describe("Nome de quem solicita o orçamento."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ project, name }) => {
    const message = [
      "Olá, 3D Create!",
      name ? `Meu nome é ${name}.` : null,
      `Gostaria de um orçamento para: ${project}`,
    ]
      .filter(Boolean)
      .join(" ");
    const url = `https://wa.me/${COMPANY.whatsapp}?text=${encodeURIComponent(message)}`;
    return {
      content: [{ type: "text", text: url }],
      structuredContent: { url, message },
    };
  },
});