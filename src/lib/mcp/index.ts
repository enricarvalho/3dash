import { defineMcp } from "@lovable.dev/mcp-js";
import getCompanyInfo from "./tools/get-company-info";
import listServices from "./tools/list-services";
import listPortfolio from "./tools/list-portfolio";
import getProcess from "./tools/get-process";
import buildQuoteLink from "./tools/build-quote-link";

export default defineMcp({
  name: "3d-create-mcp",
  title: "3D Create MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas públicas da 3D Create, estúdio de impressão 3D em Goiânia. Use `get_company_info` para dados da empresa, `list_services` para serviços, `get_process` para o fluxo de trabalho, `list_portfolio` para peças já produzidas e `build_quote_link` para montar um link de orçamento no WhatsApp.",
  tools: [getCompanyInfo, listServices, getProcess, listPortfolio, buildQuoteLink],
});