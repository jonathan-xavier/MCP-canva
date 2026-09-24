# Tech Spec — Atualização visual do frontend

- **Status:** Em implementação — código e validações automatizadas concluídos; revisão visual manual pendente
- **Data:** 23 de setembro de 2026
- **Projeto:** `MCP-canva / Ateliê Canva`
- **Escopo:** Frontend local
- **Referência obrigatória:** [`GUIA-DE-DESIGN.md`](GUIA-DE-DESIGN.md)

## 1. Resumo

Atualizar a interface atual do Ateliê Canva para seguir o sistema visual definido
em `GUIA-DE-DESIGN.md`. A migração troca tipografia, cores, hierarquia,
componentes e responsividade, mantendo inalterados o fluxo funcional, as rotas
da API local e a integração MCP com o Canva.

O resultado deve parecer uma ferramenta de produtividade clara e objetiva:
Figtree, superfícies leves, cards amplos, controles arredondados, preto para
ações conclusivas e laranja para marca, progresso e seleção.

## 2. Objetivos

- Aplicar Figtree em toda a interface.
- Usar exclusivamente as seis cores aprovadas no guia.
- Remover a identidade atual baseada em teal, coral, amarelo, creme e Georgia.
- Padronizar tipografia, espaçamento, raios, bordas, sombras e movimento.
- Reorganizar visualmente briefing, candidatos, progresso e resultado.
- Tornar todos os estados de conexão e processamento compreensíveis sem
  depender apenas de cor.
- Preservar o fluxo de escolha humana antes da criação do design.
- Manter a interface responsiva e operável por teclado.
- Evitar regressões nos testes, build e integração com a API local.

## 3. Fora do escopo

- Alterar endpoints ou contratos da API.
- Modificar OAuth, conexão MCP ou armazenamento efêmero.
- Implementar o fluxo de posts com vídeo.
- Adicionar autenticação própria, histórico ou persistência.
- Criar funcionalidades fictícias de créditos, notificações ou perfil.
- Adicionar sidebar sem uma segunda área real de navegação.
- Trocar a marca ou o nome **Ateliê Canva**.
- Hospedar ou publicar a aplicação.
- Alterar as imagens geradas pelo Canva.

## 4. Diagnóstico da interface atual

### 4.1 Divergências visuais

| Área | Estado atual | Estado desejado |
|---|---|---|
| Tipografia | Geist no corpo e Georgia nos títulos | Figtree em todos os textos |
| Pesos | Valores não padronizados, como 650, 760, 770 e 850 | Apenas 300, 400, 500 e 600 |
| Cor principal | Teal | Preto para ações; laranja para marca e seleção |
| Paleta | Teal, coral, amarelo, creme e vários cinzas | Somente as seis cores do guia |
| Títulos | Editorial, serifado e muito grande | Sans-serif, direto e orientado a produto |
| Botão principal | Teal, retangular com raio médio | Preto, em cápsula |
| Estado vazio | Pôster decorativo colorido | Composição funcional usando a paleta aprovada |
| Painéis | Divisão editorial em duas áreas | Workspace de produto com cards e canvas |
| Progresso | Faixa simples no rodapé | Stepper claro com estado atual e concluído |
| Feedback | Cores semânticas externas à paleta | Ícone + texto + cores exclusivas do guia |

### 4.2 Pontos que devem ser preservados

- formulário controlado;
- contador de caracteres;
- tipos de design vindos das capacidades do Canva;
- geração sem escolha automática;
- apresentação de todos os candidatos;
- criação após clique em **Usar este design**;
- link **Editar no Canva**;
- exportação somente nos formatos anunciados;
- mensagens `aria-live`;
- fallbacks para thumbnails;
- bloqueio de escritas simultâneas.

## 5. Sistema visual obrigatório

### 5.1 Paleta fechada

O CSS da interface pode usar somente:

| Token | Valor | Papel |
|---|---|---|
| `--color-ink` | `#000000` | Texto, ícones e ações conclusivas |
| `--color-brand` | `#F74D00` | Marca, seleção e progresso |
| `--color-border` | `#E7E7E8` | Canvas, bordas e divisores |
| `--color-accent-soft` | `#E9E3BF` | Sucesso, atenção e destaque suave |
| `--color-surface` | `#F9F9F9` | Cards, campos, topbar e painéis |
| `--color-brand-soft` | `#FDDBCC` | Erro suave, chips e ícones de marca |

Não usar branco, teal, verde, azul, vermelho ou cinzas adicionais. Sombras e
hierarquia textual podem usar opacidade de preto. Anéis de foco podem usar
opacidade do laranja.

A restrição vale para a interface. O texto escrito pelo usuário e as imagens
geradas pelo Canva podem conter qualquer cor.

### 5.2 Tipografia

Substituir `Geist` e `Georgia` por `Figtree`:

```ts
const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
});
```

O font loader deve empacotar os arquivos no build, sem chamada externa durante
o uso local. Todas as classes devem referenciar `--font-figtree` por meio do
token `--font-sans`.

Escala obrigatória:

| Papel | Desktop | Mobile | Peso |
|---|---:|---:|---:|
| Título da página | 36/44 px | 32/40 px | 500 |
| Título da área de resultado | 28/36 px | 24/32 px | 500 |
| Título de card | 18/26 px | 18/26 px | 600 |
| Corpo | 16/24 px | 16/24 px | 400 |
| Label | 14/20 px | 14/20 px | 600 |
| Caption | 12/16 px | 12/16 px | 400 |

### 5.3 Tokens

Os tokens do guia devem ser copiados para `web/app/globals.css`. Nomes antigos
como `--teal`, `--coral`, `--lemon`, `--paper`, `--ink-soft` e `--surface`
devem ser removidos, não mantidos como aliases.

Além das cores, padronizar:

- espaços de 4 a 64 px na escala do guia;
- raios de 8, 12, 16, 20 e 999 px;
- sombra pequena e média derivadas de preto com opacidade;
- duração de 120 e 180 ms;
- easing `cubic-bezier(0.2, 0, 0, 1)`;
- focus ring laranja de 3 px.

## 6. Arquitetura da tela

### 6.1 Estrutura geral

Manter uma página única com topbar e workspace. Não adicionar sidebar enquanto
existir apenas uma funcionalidade principal.

```text
┌─────────────────────────────────────────────────────────────┐
│ Topbar: marca                           status da conexão   │
├───────────────────┬─────────────────────────────────────────┤
│ Briefing          │ Direção criativa                        │
│ 360–440 px        │ candidatos, resultado ou estado vazio  │
│                   │                                         │
└───────────────────┴─────────────────────────────────────────┘
```

- topbar: 76 px, `#F9F9F9`, borda inferior;
- workspace: fundo `#E7E7E8`;
- painel de briefing: `#F9F9F9`, borda direita;
- área criativa: canvas com padding de 32–48 px;
- largura máxima opcional de 1760 px, centralizada em telas muito amplas;
- nenhuma área usa gradiente.

### 6.2 Breakpoints

| Faixa | Layout |
|---|---|
| `≥ 1280px` | Briefing fixo e conteúdo flexível; candidatos em 2 colunas |
| `900–1279px` | Colunas proporcionais; candidatos em 1 ou 2 colunas conforme largura útil |
| `720–899px` | Briefing sobre a área criativa; candidatos em 2 colunas quando couber |
| `< 720px` | Tudo em uma coluna; ações principais ocupam toda a largura |

Testar especificamente larguras de 390, 768, 1280 e 1600 px.

## 7. Componentes e alterações

### 7.1 `RootLayout`

Arquivo: `web/app/layout.tsx`.

- importar `Figtree` de `next/font/google`;
- carregar somente pesos 300, 400, 500 e 600;
- substituir a variável de Geist;
- preservar idioma, metadata e imagem social;
- não alterar URLs ou comportamento de runtime.

### 7.2 Topbar e marca

- fundo `#F9F9F9`;
- marca alinhada à esquerda;
- monograma circular com fundo laranja e texto preto;
- nome em 16 px, peso 600;
- status da conexão à direita em controle cápsula;
- status deve usar texto e ícone, não apenas ponto colorido;
- estado conectado: ícone de check + “Canva conectado”;
- aguardando: spinner + “Aguardando Canva”;
- erro: ícone de atenção + “Conexão pendente”;
- o controle mantém `aria-label` e foco visível.

### 7.3 Painel de briefing

- remover eyebrow em caixa alta e espaçamento excessivo;
- usar um rótulo curto em `label-md`, por exemplo “Novo projeto”;
- título principal em 36/44 px e peso 500;
- texto introdutório com preto a 62% de opacidade;
- textarea com superfície clara, raio de 12 px e foco laranja;
- contador de caracteres em caption;
- botão **Gerar opções** preto e em cápsula;
- botão em loading mantém a largura e apresenta spinner + “Gerando opções”;
- nota de privacidade permanece abaixo do botão.

### 7.4 Seletor de formato

- manter radio buttons nativos visualmente ocultos, mas acessíveis;
- usar cards compactos com altura mínima de 64 px;
- estado padrão: superfície + borda;
- estado selecionado: borda laranja, fundo `#FDDBCC` e marca textual ou ícone;
- foco: anel laranja externo;
- não indicar seleção somente por cor;
- em mobile, usar uma coluna; acima de 480 px, duas colunas.

### 7.5 Cabeçalho da direção criativa

- título dinâmico permanece;
- badge “n de 3” deve virar parte do stepper ou chip secundário;
- alinhar título e progresso sem quebrar em larguras pequenas;
- textos usam apenas Figtree.

### 7.6 Estado vazio

Substituir o pôster inclinado, serifas, grade decorativa e cores antigas por uma
composição de produto:

- card de superfície com raio de 20 px;
- ícone ou composição geométrica usando preto, laranja, `#FDDBCC` e `#E9E3BF`;
- título “Suas opções aparecem aqui”;
- descrição curta sobre comparação de caminhos visuais;
- stepper visível abaixo ou dentro da área;
- elemento decorativo deve ter `aria-hidden="true"`.

### 7.7 Mensagens de processamento

O banner de progresso usa:

- fundo `#E9E3BF`;
- texto preto;
- spinner preto ou laranja;
- `aria-live="polite"` e `aria-atomic="true"`;
- descrição específica para conexão, geração, criação e exportação;
- sem animação quando `prefers-reduced-motion` estiver ativo.

### 7.8 Erros

- fundo `#FDDBCC`;
- ícone e título em laranja;
- texto explicativo preto;
- ação de recuperação sublinhada ou em botão secundário;
- `role="alert"`;
- não depender do laranja para comunicar erro;
- preservar briefing e candidatos existentes quando a ação puder ser repetida.

### 7.9 `CandidateCard`

Arquivo: `web/components/CandidateCard.tsx`.

- fundo `#F9F9F9`;
- raio de 16 px;
- borda neutra e sombra pequena;
- imagem usa `object-fit: contain`;
- índice da opção em chip;
- link **Ver maior** em preto sublinhado;
- botão **Usar este design** preto e em cápsula;
- fallback de imagem usa somente formas e cores da paleta;
- botão mantém altura mínima de 44 px;
- durante criação, exibir feedback no candidato acionado se o estado permitir;
- nenhum candidato aparece selecionado antes do clique.

O contrato de propriedades atual pode ser preservado. Se for necessário mostrar
qual card está criando, adicionar `isCreating: boolean` sem alterar os dados da
API.

### 7.10 Resultado do design

- card amplo de superfície;
- indicador de sucesso com ícone de check, texto e fundo `#E9E3BF`;
- título em 28/36 px;
- **Editar no Canva** como botão principal preto;
- **Criar outro** como botão secundário;
- formatos de exportação em chips/botões secundários;
- botão que está exportando mostra progresso sem bloquear leitura dos demais;
- downloads prontos aparecem em lista com a indicação “link temporário”.

### 7.11 Stepper

Manter três etapas funcionais:

```text
1. Briefing → 2. Escolha → 3. Exporte
```

- etapa concluída: círculo laranja com check e rótulo;
- etapa atual: borda laranja, número e `aria-current="step"`;
- etapa futura: borda neutra;
- conectores usam `#E7E7E8`;
- em mobile, pode usar rótulos compactos, mas não apenas números.

## 8. Organização de código

Estrutura recomendada:

```text
web/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── CandidateCard.tsx
│   ├── ConnectionStatus.tsx
│   ├── DesignResult.tsx
│   ├── EmptyState.tsx
│   ├── FormatSelector.tsx
│   └── ProcessStepper.tsx
└── lib/
    ├── canva-api.ts
    └── types.ts
```

Não é obrigatório criar um componente para cada elemento pequeno. Extrair uma
seção quando ela tiver estado próprio, for reutilizada ou tornar `page.tsx`
difícil de revisar. A atualização não deve introduzir uma biblioteca visual.

## 9. Estratégia de CSS

- manter CSS próprio em `globals.css` nesta fase;
- organizar o arquivo na ordem: tokens, reset, layout, componentes, estados,
  responsividade e reduced motion;
- usar classes semânticas existentes quando o papel não mudar;
- evitar valores hex fora da declaração dos seis tokens;
- componentes devem consumir variáveis, não repetir hex;
- opacidade deve ser aplicada ao elemento ou derivada de preto/laranja;
- remover seletores e animações que deixarem de ser usados;
- não usar `!important`, exceto na regra global de reduced motion se necessário.

Adicionar uma verificação automatizada de paleta, por exemplo
`web/scripts/check-ui-palette.mjs`, que rejeite cores hexadecimais no CSS que
não pertençam à allowlist:

```text
#000000 #F74D00 #E7E7E8 #E9E3BF #F9F9F9 #FDDBCC
```

O script deve ignorar conteúdo de usuário, imagens e arquivos gerados.

## 10. Acessibilidade

- manter landmarks `header`, `main`, `aside` e `section` com nomes acessíveis;
- usar hierarquia de headings sem saltos;
- garantir foco visível em todos os controles;
- manter contraste de texto preto sobre superfícies claras;
- usar preto sobre laranja;
- usar `#F9F9F9` sobre botões pretos;
- áreas clicáveis com no mínimo 44 × 44 px;
- `aria-current="step"` no progresso;
- `aria-busy="true"` na região em processamento;
- ícones decorativos com `aria-hidden`;
- mensagens de erro ligadas ao campo quando a falha for de validação;
- navegação completa por teclado;
- layout utilizável com zoom de 200%;
- movimento reduzido respeitado.

## 11. Responsividade detalhada

### Desktop

- briefing entre 360 e 440 px;
- candidatos em duas colunas;
- topbar horizontal;
- resultado centralizado com largura máxima legível.

### Tablet

- painel de briefing acima da direção criativa;
- formatos em duas colunas;
- candidatos em duas colunas quando cada card tiver pelo menos 300 px;
- ações podem quebrar para nova linha.

### Mobile

- padding lateral entre 16 e 20 px;
- título principal de 32 px;
- formatos e candidatos em uma coluna;
- botões principais com largura total;
- ações de candidato empilhadas;
- topbar mantém marca e status sem truncar a informação essencial;
- stepper pode rolar horizontalmente apenas se não houver alternativa legível;
- nenhuma rolagem horizontal na página.

## 12. Estados funcionais a validar

| Estado | Resultado visual esperado |
|---|---|
| `connecting` | Status com spinner e instrução de OAuth |
| `idle` | Briefing disponível e estado vazio orientativo |
| `generating` | Botão bloqueado, mensagem viva e layout estável |
| `choosing` | Todos os candidatos visíveis e nenhum pré-selecionado |
| `creating` | Ações de escrita bloqueadas e candidato acionado identificado |
| `created` | Link de edição dominante e formatos suportados visíveis |
| `exporting` | Formato em andamento identificado |
| `download-ready` | Link temporário claramente rotulado |
| `error` | Mensagem textual, ícone e recuperação aplicável |

## 13. Testes

### Automatizados

- testes atuais de API client continuam passando;
- `CandidateCard` mantém nome acessível da imagem e envia o ID correto;
- seletor de formato comunica o radio selecionado;
- stepper marca a etapa atual semanticamente;
- conexão e processamento expõem texto acessível;
- erro usa `role="alert"`;
- nenhuma escolha ocorre durante a geração;
- formatos de exportação continuam vindo da resposta da API;
- script de paleta falha diante de cor não permitida;
- lint, typecheck e build passam.

### Matriz manual

Verificar os estados `idle`, `connecting`, `generating`, `choosing`, `creating`,
`created`, `exporting` e `error` nas larguras:

- 390 px;
- 768 px;
- 1280 px;
- 1600 px.

Verificar também:

- teclado sem mouse;
- zoom de 200%;
- tema do sistema claro e escuro — a aplicação permanece clara até existir uma
  especificação própria de tema escuro;
- `prefers-reduced-motion`;
- thumbnail disponível e indisponível;
- títulos longos de design;
- lista extensa de formatos de exportação.

## 14. Critérios de aceite

- Figtree é a única fonte visual da aplicação.
- Somente as seis cores do guia aparecem no CSS do produto.
- Não restam tokens teal, coral, lemon, paper ou cores antigas.
- Títulos não usam fonte serifada.
- Botões conclusivos são pretos e em cápsula.
- Laranja é usado apenas para marca, seleção e progresso.
- Status e erros continuam compreensíveis em escala de cinza.
- O layout funciona sem rolagem horizontal nas larguras definidas.
- Todos os controles possuem foco visível e área mínima de 44 px.
- Nenhum candidato é escolhido automaticamente.
- A atualização não altera payloads ou rotas da API.
- Testes existentes e novos passam.
- `npm --prefix web run lint`, `npm --prefix web test` e
  `npm run web:build` terminam com sucesso.

## 15. Plano de implementação

### Fase 1 — Fundação

- trocar Geist por Figtree;
- substituir tokens e reset;
- adicionar verificação automatizada da paleta;
- normalizar tipografia, espaços, raios, sombras e foco.

### Fase 2 — Estrutura

- atualizar topbar e workspace;
- revisar painel de briefing;
- atualizar seletor de formato;
- substituir estado vazio;
- implementar stepper semântico.

### Fase 3 — Fluxo principal

- atualizar cards de candidato;
- atualizar estados de processamento e erro;
- atualizar resultado, exportações e downloads;
- extrair componentes quando necessário.

### Fase 4 — Qualidade

- ampliar testes de componentes;
- validar matriz responsiva;
- revisar teclado, zoom, contraste e reduced motion;
- executar lint, testes, build e verificação de paleta;
- remover CSS não utilizado.

## 16. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Texto com baixo contraste sobre laranja | Usar sempre preto sobre `#F74D00` |
| Estados sem cores semânticas tradicionais | Combinar ícone, rótulo, mensagem e estrutura |
| Regressão funcional durante extração | Manter handlers em `page.tsx` inicialmente e extrair incrementalmente |
| Layout quebrado por títulos do Canva | Usar wrapping, limites flexíveis e testes com conteúdo longo |
| Fonte indisponível em runtime local | Empacotar Figtree durante o build |
| CSS antigo permanecer ativo | Remover tokens antigos e rodar busca/verificação automatizada |
| Aparência de seleção automática | Não aplicar borda de seleção antes do clique explícito |

## 17. Entrega

A atualização é considerada pronta quando o front adotar integralmente o guia,
preservar o fluxo funcional e passar pela matriz de testes. A implementação deve
ser entregue em um commit separado da documentação para facilitar revisão e
eventual reversão visual.
