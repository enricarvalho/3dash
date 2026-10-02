# 3D Create - Site

Crie uma landing page para a "3D Create", empresa de impressão 3D localizada em Goiânia, 
Brasil, com nível de produção cinematográfico — misturando fundo com partículas 3D interativas, 
storytelling por scroll, imagens de arte 3D premium e clareza total de produto/conversão.

═══════════════════════════════
IDENTIDADE DA MARCA
═══════════════════════════════
- Nome: 3D Create
- Logo: círculo com gradiente diagonal azul (#4B4BFF) → roxo (#9B4DFF), com ícone de 
  asterisco/estrela de 8 pontas branco no centro
- Slogan: "Criamos ideias. Materializamos possibilidades."
- Localização: Goiânia, GO
- Serviços: peças personalizadas, protótipos, itens de decoração
- CTA principal: "Solicite seu orçamento"
- Paleta: gradiente azul → roxo como cor de destaque; fundo alternando entre branco/claro 
  (seções de conteúdo) e quase-preto com o gradiente (hero e seções de impacto)

═══════════════════════════════
HERO — IMPACTO CINEMATOGRÁFICO
═══════════════════════════════
- Fundo escuro com sistema de partículas em Three.js/React Three Fiber, simulando pó/filamento 
  de impressão 3D flutuando, reagindo sutilmente ao movimento do mouse
- Gradiente radial de fundo (azul profundo → roxo) para dar profundidade e atmosfera de 
  "horizonte" digital
- Um objeto 3D girando lentamente no centro (wireframe do ícone/asterisco da marca ou uma 
  peça impressa genérica)
- Headline e logo entram com fade-in lento e delayed transitions — nada aparece de forma abrupta
- CTA "Solicite seu orçamento" com hover reveal: ganha o gradiente da marca e um leve glow

═══════════════════════════════
STORYTELLING POR SCROLL
═══════════════════════════════
- Cada seção é revelada progressivamente conforme o usuário rola — fade/slide-up, ritmo lento 
  e intencional, nunca instantâneo
- Transições de cor de fundo entre seções (hero escuro → seções claras → seção final escura 
  para o formulário), criando uma "jornada" visual
- Leve parallax entre camadas (partículas de fundo se movem mais devagar que o conteúdo)

═══════════════════════════════
ESTRUTURA MODULAR
═══════════════════════════════
1. Hero — conforme acima
2. "O que fazemos" — 3 cards (Personalizados / Protótipos / Decoração), grid limpo, revelados 
   um a um ao rolar, cada card com sua imagem de arte 3D (ver seção de imagens abaixo)
3. "Como funciona" — linha do tempo de 3-4 passos, cada um se ilumina/ativa ao entrar na tela
4. Portfólio — grid de 4-6 imagens estilo still-life cinematográfico (placeholders), hover 
   revela detalhes do projeto ("hidden reveal")
5. "Por que a 3D Create" — diferenciais com números/selos de confiança, tipografia grande e 
   impactante estilo "mission control"
6. Formulário de orçamento — fundo escuro novamente para fechar a jornada: nome, WhatsApp/
   e-mail, descrição do projeto, upload de referência
7. Footer — logo, Instagram (@3d.create_), localização, contato

═══════════════════════════════
IMAGENS — ARTES 3D CINEMATOGRÁFICAS PREMIUM
═══════════════════════════════
Inclua renders 3D de alta qualidade, estilo cinematográfico (iluminação dramática, profundidade 
de campo, materiais realistas), na paleta azul/roxo da marca:
1. Hero: objeto sendo "impresso" camada por camada, partículas de luz saindo da ponta da 
   impressora, fundo escuro com gradiente azul-roxo
2. Cards "O que fazemos": (a) peça geométrica flutuando com luz de estúdio, (b) protótipo 
   mecânico em still-life com reflexos, (c) objeto decorativo orgânico com textura de filamento
3. Portfólio: 4-6 "peças" fictícias em still-life cinematográfico, fundo levemente variado 
   dentro da mesma paleta, estilo catálogo premium
4. CTA final: peça "pronta" iluminada dramaticamente, hero-shot de produto de tecnologia

Prompt de referência para gerar essas imagens: "cinematic 3D render, [descrição do objeto], 
dramatic studio lighting, deep blue to purple gradient background, glossy and matte material 
contrast, floating particles, ultra detailed, premium product photography style, 8k"

Referencie como assets substituíveis (ex: /images/hero-render.png) e aplique leve efeito de 
tilt/parallax 3D ao passar o mouse sobre elas.

═══════════════════════════════
MOTION E POLISH GERAL
═══════════════════════════════
- Transições sempre lentas e intencionais
- Scroll-triggered animations em todas as seções (fade, slide, leve parallax)
- Botão flutuante de WhatsApp com pulso sutil
- Totalmente responsivo (mobile-first)
- Tipografia com contraste forte: título grande e impactante + corpo de texto limpo e leve

Priorize: o "uau" cinematográfico no hero e nas transições de scroll, mantendo total clareza 
de conversão nas seções de produto e no formulário.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://create-3d.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/73d85fb6-5a7c-4a22-96ac-df32579d81ab).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
