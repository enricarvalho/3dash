import { defineTool } from "@lovable.dev/mcp-js";
import { PROCESS } from "../content";

export default defineTool({
  name: "get_process",
  title: "Como funciona",
  description:
    "Descreve as etapas do processo de trabalho da 3D Create, da conversa inicial até a entrega.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(PROCESS, null, 2) }],
    structuredContent: { steps: PROCESS },
  }),
});