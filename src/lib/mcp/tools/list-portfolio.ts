import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { PORTFOLIO } from "../content";

export default defineTool({
  name: "list_portfolio",
  title: "Listar portfólio",
  description:
    "Lista as peças do portfólio público da 3D Create, com material e detalhe técnico. Opcionalmente filtra por material.",
  inputSchema: {
    material: z
      .string()
      .optional()
      .describe("Filtro opcional por material, ex.: PLA, PETG, ABS, Resina."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ material }) => {
    const query = material?.trim().toLowerCase();
    const items = query
      ? PORTFOLIO.filter((p) => p.material.toLowerCase().includes(query))
      : PORTFOLIO;
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { items },
    };
  },
});