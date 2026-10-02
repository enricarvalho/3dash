import { defineTool } from "@lovable.dev/mcp-js";
import { SERVICES } from "../content";

export default defineTool({
  name: "list_services",
  title: "Listar serviços",
  description:
    "Lista os serviços de impressão 3D da 3D Create (personalizados, protótipos e decoração) com descrição de cada um.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(SERVICES, null, 2) }],
    structuredContent: { services: SERVICES },
  }),
});