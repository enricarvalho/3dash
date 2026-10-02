import { auth, defineMcp } from "@lovable.dev/mcp-js";

import { BRAND } from "../brand";

import listStock from "./tools/list-stock";
import listCustomers from "./tools/list-customers";
import createCustomer from "./tools/create-customer";
import listParts from "./tools/list-parts";
import listQuotes from "./tools/list-quotes";
import listSales from "./tools/list-sales";
import financialSummary from "./tools/financial-summary";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "painel-operacional",
  title: BRAND.appName,
  version: "0.1.0",
  instructions:
    "Ferramentas de gestão de produção 3D: estoque de filamentos, clientes, peças, orçamentos, vendas e financeiro. Todas as operações rodam como o usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listStock,
    listCustomers,
    createCustomer,
    listParts,
    listQuotes,
    listSales,
    financialSummary,
  ],
});
