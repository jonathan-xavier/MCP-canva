# Canva Banner MCP Client

Cliente local em TypeScript para criar, editar e exportar banners usando o
[MCP remoto oficial do Canva](https://www.canva.dev/docs/apps/mcp/).

O projeto não reimplementa a API do Canva. A CLI se conecta ao endpoint oficial
`https://mcp.canva.com/mcp` por meio do `mcp-remote`, que conduz o login OAuth e
mantém os tokens fora do repositório.

## Pré-requisitos

- Node.js 22.7.5 ou superior (recomendado: Node.js 24).
- Uma conta do Canva.
- Um navegador disponível para o primeiro login OAuth.

## Instalação

```bash
npm install
npm test
```

Não é necessário colocar usuário, senha ou token do Canva em `.env`. Na primeira
conexão, o navegador abre a autorização oficial do Canva. Cada pessoa autentica
sua própria conta.

Para alterar opções locais, copie o exemplo:

```bash
cp .env.example .env
```

## Confirmar a conexão

```bash
npm run tools
```

Na primeira execução:

1. O navegador abrirá a tela do Canva.
2. Entre na sua conta e autorize a conexão.
3. Volte ao terminal.
4. A CLI exibirá as ferramentas liberadas para sua conta e seu plano.

Para ver também os schemas de entrada anunciados pelo servidor:

```bash
npm run tools -- --json
```

Para inspecionar somente uma ferramenta:

```bash
npm run tools -- --name create-design
```

## Usar o front local

Instale também as dependências da interface e inicie API e front com um único
comando:

```bash
npm --prefix web install
npm run local
```

Abra `http://127.0.0.1:5173`. A API fica disponível somente em
`http://127.0.0.1:3000`; o navegador acessa suas rotas pelo proxy `/api` do
Vite. Na primeira conexão, conclua o OAuth na janela oficial do Canva que for
aberta.

No fluxo visual você escreve o briefing, escolhe o formato, compara todos os
candidatos e decide qual deles será transformado em um design. Nenhuma opção é
escolhida automaticamente. Depois da criação, é possível abrir o design no
Canva e exportar somente nos formatos anunciados para ele.

Para validar o front separadamente:

```bash
npm --prefix web test
npm --prefix web run lint
npm run web:build
```

## Criar um banner

Modo interativo:

```bash
npm run banner
```

Com um briefing completo:

```bash
npm run banner -- --brief "Crie um post vertical para Instagram, 1080x1350, anunciando 30% de desconto na Semana da Tecnologia. Use azul-marinho, branco e amarelo, estilo moderno, título 'Semana da Tecnologia' e CTA 'Compre agora'."
```

O tipo padrão é `instagram_post` (1080 × 1350). Para outro formato anunciado
pelo Canva, use `--design-type`, por exemplo `poster`, `flyer`,
`youtube_thumbnail` ou `your_story`.

O Canva gera candidatos e a CLI mostra todos antes de pedir uma escolha. Somente
o candidato escolhido é transformado em um design editável.

Para automatizar a escolha e exportar o design:

```bash
npm run banner -- \
  --brief-file resources/prompts/prompt-mcp-canva.txt \
  --choose 1 \
  --export png
```

O resultado contém o ID do design, o link de edição no Canva e, se solicitado,
um link temporário para download.

> `--choose` deve ser usado apenas quando a escolha humana já estiver definida.
> Não selecione automaticamente um candidato em uma automação de produção.

## Exportar um design existente

```bash
npm run export -- --design-id DAF_EXEMPLO --format png
```

Formatos comuns: `png`, `jpg`, `pdf`, `pptx`, `gif` e `mp4`. A disponibilidade
real depende do tipo do design, do plano e das ferramentas anunciadas pelo
Canva. Links assinados de exportação expiram; use-os imediatamente.

## Editar um design

A edição oficial usa uma transação: abrir, aplicar operações e confirmar. A CLI
só informa sucesso depois do commit.

```bash
npm run edit -- \
  --design-id DAF_EXEMPLO \
  --page-index 1 \
  --operations-file operations.json
```

Os IDs dos elementos vêm da resposta de `start-editing-transaction`. Confira o
schema e o conteúdo atual com `npm run tools -- --json` ou use um cliente de IA
conectado diretamente ao Canva MCP, que consegue conduzir esse fluxo de forma
conversacional.

A CLI aplica as operações em rascunho, mostra a resposta e as miniaturas e pede
que você digite `SIM`. Qualquer outra resposta cancela a transação; ela nunca
confirma uma edição silenciosamente.

Para diagnóstico ou ferramentas novas, existe uma chamada genérica:

```bash
npm run call -- --tool search-designs --args '{"query":"campanha"}'
```

## Conectar diretamente a outro cliente MCP

O arquivo [`resources/mcps/mcp-remote.example.json`](resources/mcps/mcp-remote.example.json)
contém uma configuração compatível com clientes que usam o formato
`mcpServers`. Copie o bloco para a configuração do seu cliente.

Clientes com suporte nativo a MCP remoto podem apontar diretamente para:

```text
https://mcp.canva.com/mcp
```

## Aplicação própria e Canva Developer Portal

Esta CLI pessoal usa o fluxo OAuth conduzido pelo `mcp-remote`. Se a integração
for incorporada em um produto para vários usuários, crie um app no
[Canva Developer Portal](https://www.canva.com/developers/apps), ative **Canva
MCP** em **Outside Canva**, cadastre a URL de redirecionamento e mantenha Client
ID/Client Secret somente no backend. Consulte o
[quickstart oficial](https://www.canva.dev/docs/apps/quickstart/).

O Canva não usa uma única conta de serviço para acessar o conteúdo de todos os
usuários. Cada usuário precisa autorizar a própria conta.

## Segurança

- `.env`, tokens, logs e diretórios de autenticação não são versionados.
- A CLI nunca solicita nem registra sua senha do Canva.
- Os tokens do `mcp-remote` ficam no diretório privado padrão da ferramenta ou
  no local indicado por `MCP_REMOTE_CONFIG_DIR`.
- Não envie links assinados de exportação para logs públicos.
- Não adicione `CANVA_CLIENT_SECRET` ao frontend ou ao repositório.

## Planos e limitações

Geração, edição, busca e exportação estão disponíveis nos planos em geral. Alguns
recursos têm exigências adicionais, por exemplo:

- redimensionamento: Canva Pro ou superior;
- brand kits e criação a partir de Brand Templates: Canva Pro ou superior;
- Autofill: Canva Enterprise;
- elementos premium podem exigir licença na exportação.

Consulte a tabela atual em
[MCP tools and rate limits](https://www.canva.dev/docs/apps/mcp/tools/).

## Desenvolvimento

```bash
npm run typecheck
npm test
npm run build
```

Os testes usam um MCP simulado e não acessam sua conta. Eles cobrem descoberta
de argumentos pelo schema, geração e escolha de candidato, exportação, edição
transacional e propagação de erros.

Estrutura principal:

```text
src/remote-client.ts   conexão MCP e OAuth via mcp-remote
src/canva-service.ts   fluxos de geração, criação, edição e exportação
src/http/              API local, conexão única e estado efêmero
src/arguments.ts       adaptação ao schema publicado pelo Canva
src/cli.ts             interface de linha de comando
web/                   interface React local
test/                  testes sem acesso externo
resources/prompts/     briefing reutilizável
resources/mcps/        exemplo de configuração MCP
```

## Solução de problemas

- **A geração demorou:** aumente `CANVA_MCP_TIMEOUT_MS` no `.env`.
- **O login não abriu:** confirme que há um navegador padrão e execute novamente
  `npm run tools`.
- **Uma ferramenta não aparece:** ela pode não estar disponível no plano ou na
  região da conta; a CLI usa a lista real anunciada pelo servidor.
- **OAuth inválido ou expirado:** refaça a autenticação pelo cliente. Antes de
  remover credenciais locais, confira onde `mcp-remote` está armazenando os
  tokens e faça backup se necessário.
- **Exportação falhou:** confirme o formato suportado e se o design contém
  elementos premium sem licença.
