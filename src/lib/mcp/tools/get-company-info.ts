import { defineTool } from "@lovable.dev/mcp-js";
import { COMPANY } from "../content";

export default defineTool({
  name: "get_company_info",
  title: "Informações da 3D Create",
  description:
    "Retorna dados públicos da 3D Create: nome, slogan, localização, serviços oferecidos e canais de contato.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(COMPANY, null, 2) }],
    structuredContent: { company: COMPANY },
  }),
});