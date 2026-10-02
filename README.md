# Painel operacional (white label)

SaaS de gestão para empresas de impressão 3D, com módulos de estoque, clientes,
peças criadas, orçamentos, financeiro e relatórios. White label: nenhuma
marca de cliente fica fixa no código.

═══════════════════════════════

IDENTIDADE VISUAL (WHITE LABEL)

═══════════════════════════════

- Nome do app, slogan, empresa padrão e cores dos PDFs: `src/lib/brand.ts`

- Cores da interface: tokens `--brand` / `--brand-2` / `--primary` em `src/styles.css`

- Nome, contatos e rodapé de cada empresa: tela Configurações (tabela `profiles`),
  usados no cabeçalho de impressão, orçamentos, recibos, DRE e fechamento de caixa

- Logo: ícone genérico em `src/components/Logo.tsx`; favicon em `public/favicon.png`

- Interface tipo dashboard SaaS: sidebar de navegação fixa + área de conteúdo, cards, tabelas, 

  gráficos — limpo, modular, sem excesso de decoração (prioridade é clareza de dados)

═══════════════════════════════

ESTRUTURA GERAL

═══════════════════════════════

- Login/autenticação simples (e-mail + senha)

- Sidebar com navegação entre os módulos: Dashboard, Estoque, Clientes, Peças, Orçamentos, 

  Financeiro, Relatórios, Configurações

- Dashboard inicial com visão geral: resumo financeiro do mês, orçamentos pendentes, estoque 

  baixo, últimas peças produzidas — em cards e gráficos

═══════════════════════════════

MÓDULO 1 — ESTOQUE

═══════════════════════════════

- Cadastro de itens: filamentos/materiais (nome, cor, tipo — PLA, ABS, PETG etc., fornecedor, 

  custo por kg/unidade, quantidade em estoque, quantidade mínima de alerta)

- Lista com busca e filtro por tipo/status (ok, baixo, esgotado)

- Alerta visual (badge colorido) quando o estoque está abaixo do mínimo

- Histórico de entradas e saídas (movimentações), com data e motivo (compra, uso em produção, 

  ajuste)

- Tela de "dar baixa" no estoque ao vincular material usado em uma peça/pedido

═══════════════════════════════

MÓDULO 2 — CLIENTES

═══════════════════════════════

- Cadastro de clientes: nome, contato (WhatsApp/e-mail), tipo (pessoa física/empresa), 

  observações

- Lista com busca, ordenável por nome ou data de cadastro

- Página de detalhe do cliente: histórico de orçamentos, pedidos e pagamentos vinculados a ele

- Tags/status (ex: ativo, recorrente, lead)

═══════════════════════════════

MÓDULO 3 — PEÇAS CRIADAS

═══════════════════════════════

- Catálogo de peças/produtos já modelados ou produzidos: nome, categoria (personalizado/

  protótipo/decoração), imagem de referência, tempo médio de impressão, material usado, 

  custo estimado

- Possibilidade de vincular uma peça a um orçamento/pedido específico

- Filtro por categoria e busca por nome

═══════════════════════════════

MÓDULO 4 — ORÇAMENTOS

═══════════════════════════════

- Criação de orçamento: cliente vinculado, peça(s)/itens, quantidade, material, tempo estimado, 

  valor unitário, valor total (calculado automaticamente)

- Status do orçamento: rascunho, enviado, aprovado, recusado, em produção, concluído — como 

  um pipeline (kanban ou lista com badges de status)

- Geração de PDF/resumo do orçamento para enviar ao cliente

- Conversão de orçamento aprovado em pedido/produção

═══════════════════════════════

MÓDULO 5 — FINANCEIRO

═══════════════════════════════

- Lançamentos de entradas (recebimentos de clientes) e saídas (compra de material, manutenção 

  de equipamento, outras despesas)

- Vinculação de entradas com orçamentos/pedidos correspondentes

- Visão de fluxo de caixa: saldo atual, entradas e saídas do mês, gráfico de evolução

- Filtro por período (mês, trimestre, ano) e por categoria de despesa/receita

- Indicador simples de lucro (receitas - despesas) do período selecionado

═══════════════════════════════

MÓDULO 6 — RELATÓRIOS

═══════════════════════════════

- Relatório de faturamento por período (gráfico de barras/linha)

- Relatório de peças mais produzidas/vendidas

- Relatório de clientes que mais geram receita

- Relatório de consumo de material por período

- Exportação dos relatórios em PDF ou CSV

═══════════════════════════════

DETALHES TÉCNICOS E UX

═══════════════════════════════

- Totalmente responsivo, mas priorizar a experiência desktop (uso operacional diário)

- Tabelas com paginação, ordenação e busca em todos os módulos com listas

- Modais ou painéis laterais para criar/editar registros sem sair da tela atual

- Notificações simples (toast) ao salvar, editar ou excluir registros

- Gráficos usando uma biblioteca simples (ex: Recharts), com cores da paleta da marca

Priorize: fluxo de trabalho rápido para uso diário (cadastrar orçamento, dar baixa em estoque, 

lançar financeiro) e dashboards que dão visão clara da saúde do negócio em poucos segundos.

## Desenvolvimento

```sh
npm install
npm run dev   # http://localhost:3000 (ou a porta em $PORT)
```

Banco: Supabase (`supabase/config.toml` e `.env`). Para um banco novo, rode as
migrações de `supabase/migrations` em ordem e crie o bucket privado `part-images`.
Deploy: Vercel (o build detecta o ambiente automaticamente).
