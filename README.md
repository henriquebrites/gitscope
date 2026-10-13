# GitHub Explorer

O GitHub Explorer é uma aplicação web (SPA) que consulta a API pública do
GitHub: você busca um usuário, vê o perfil público, navega pelos repositórios
ordenados e abre o detalhe de cada um. Este documento explica o que a
aplicação faz, como instalar, testar e gerar o build, e por que as principais
decisões foram tomadas.

## Funcionalidades

A aplicação cobre a busca, o perfil, a lista e o detalhe de repositórios, com
estados de carregamento, erro e vazio em cada tela.

- **Busca de usuário:** o campo fica no cabeçalho de todas as telas, remove
  espaços extras, recusa entrada vazia com orientação e desabilita o envio
  enquanto o perfil carrega.
- **Perfil público:** avatar, login, nome, seguidores, seguindo, bio, e-mail
  público e link para o perfil no GitHub; campos ausentes são omitidos ou
  substituídos, nunca exibidos como `null`.
- **Lista de repositórios:** todas as páginas da API são carregadas antes da
  exibição; a lista começa por estrelas (maior para menor), com desempate pelo
  nome, e pode ser ordenada por estrelas (menor para maior), nome (A a Z) ou
  última atualização. A paginação visual mostra 30 itens por página.
- **Detalhe do repositório:** nome, descrição, estrelas, linguagem e link para o
  GitHub. A rota abre por acesso direto, refresh ou link compartilhado, e o
  link de volta restaura a ordenação e a página da lista.
- **Tratamento de falhas:** mensagens específicas para conta ou repositório não
  encontrado, falha de rede, limite de requisições da API (com o horário de
  liberação) e erro inesperado. Se só os repositórios falharem, o perfil
  continua visível.
- **Acessibilidade e responsividade:** funciona a partir de 320 × 480 px sem
  rolagem horizontal, com foco visível, navegação por teclado e regiões
  `aria-live` (carregamento) e `role="alert"` (erros).

## Stack

A aplicação usa React com TypeScript, empacotada pelo Vite. As versões abaixo
são as instaladas pelo `package-lock.json`.

| Uso | Ferramenta | Versão |
| --- | --- | --- |
| Interface | React e React DOM | 19.3.0 |
| Linguagem | TypeScript | 6.0.3 |
| Build e servidor de desenvolvimento | Vite | 8.3.4 |
| Rotas | React Router DOM (data mode, sem loaders) | 7.18.4 |
| Estilo | Tailwind CSS (com `@tailwindcss/vite`) | 4.3.3 |
| Fontes auto-hospedadas | `@fontsource-variable/geist` e `geist-mono` | 5.3.0 |
| Testes unitários e de componentes | Vitest, React Testing Library e jsdom | 5.0.4, 16.3.3, 30.1.2 |
| Testes end-to-end | Playwright (Chromium) | 1.64.0 |
| Lint | ESLint | 10.12.0 |

O estado compartilhado usa Context API com `useReducer`, e as chamadas HTTP
usam a Fetch API, sem bibliotecas adicionais.

## Pré-requisitos

Você precisa destas ferramentas instaladas antes de começar:

- **Node.js 22.12 ou mais recente** (22.x a partir de 22.12, ou 24.x). O
  Vitest 5 exige `^22.12.0 || ^24.0.0 || >=26.0.0`. O projeto foi
  desenvolvido com Node.js 24.21.0.
- **npm** (instalado com o Node.js).
- **Git**, para clonar o repositório.

## Instalação

Para preparar o projeto a partir de um clone novo, siga estas etapas:

1.  Clone o repositório e entre na pasta:

    ```bash
    git clone https://github.com/henriquebrites/gitscope.git
    cd gitscope
    ```

2.  Instale as dependências:

    ```bash
    npm install
    ```

3.  Instale o Chromium usado pelos testes end-to-end (necessário só para
    `npm run test:e2e`):

    ```bash
    npx playwright install chromium
    ```

A aplicação não usa variáveis de ambiente nem token do GitHub.

## Comandos

Todos os comandos rodam na raiz do projeto.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento do Vite em `http://localhost:5173`. |
| `npm test` | Roda os testes unitários e de componentes (Vitest + React Testing Library, jsdom). |
| `npm run test:e2e` | Gera o build, sobe o `vite preview` na porta 4173 e roda a suíte Playwright no Chromium. |
| `npm run lint` | Roda o ESLint em todo o projeto. |
| `npm run build` | Verifica os tipos (`tsc -b`) e gera o build de produção em `dist/`. |
| `npm run preview` | Serve o build de `dist/` localmente. |

Os testes nunca acessam a API real nem a internet. No Vitest, o `fetch` é
substituído por respostas simuladas. No Playwright, cada chamada a
`https://api.github.com` é atendida por `page.route` com dados locais, e uma
proteção compartilhada (`tests/support/test.ts`) bloqueia e reprova qualquer
requisição externa que nenhum teste tenha interceptado.

### Medir com o Lighthouse

O Lighthouse não é uma dependência do projeto. Para medir o build em modo
mobile, siga estas etapas:

1.  Gere e sirva o build:

    ```bash
    npm run build
    npm run preview
    ```

2.  Em outro terminal, crie a pasta dos relatórios e rode o Lighthouse pelo
    `npx` (ele usa o Google Chrome instalado):

    ```bash
    mkdir -p lighthouse
    npx lighthouse@13.5.0 http://localhost:4173/ --form-factor=mobile \
      --output=json --output=html --output-path=./lighthouse/home \
      --chrome-flags="--headless=new"
    ```

Os relatórios ficam em `lighthouse/`, pasta ignorada pelo Git. A última
medição, em 13 de outubro de 2026, deu Performance 98, Accessibility 100,
Best Practices 100 e SEO 82.

## Estrutura de pastas

O código separa páginas, componentes de apresentação, integração com a API,
estado compartilhado, tipos e utilitários.

```text
src/
  app/          rotas (data mode) e App; testes de rota com createMemoryRouter
  components/
    feedback/   conteúdo de erro compartilhado entre as telas
    layout/     cabeçalho, layout e container de página
    profile/    cartão, skeleton e erros do perfil
    repositories/  lista, item, ordenação, paginação e detalhe
    search/     formulário de busca
  context/      GitHubContext, provider e reducer (cache em memória)
  hooks/        useProfile, useRepositories e useRepository
  pages/        HomePage, UserPage, RepositoryPage, NotFoundPage, RouteErrorPage
  services/     githubApi: URLs, fetch, paginação e erros de domínio
  types/        tipos da API e do domínio
  utils/        ordenação, formatação pt-BR, paginação e query da lista
  test/         setup do Vitest e testes de tokens e camadas
tests/          specs Playwright e stubs da API (tests/support/)
```

## Decisões relevantes

Estas decisões definem o comportamento da aplicação e explicam escolhas que
não ficam evidentes só pelo código.

- **A URL é a fonte de verdade.** Usuário, repositório, ordenação e página vêm
  da rota (`/users/:username`, `/users/:username/repos/:repoName`,
  `?sort=&page=`). Qualquer rota funciona em acesso direto e refresh. Valores
  inválidos de `sort` voltam para estrelas decrescentes e uma `page` inválida
  volta para 1. Uma nova busca abre o perfil sem query string, o que restaura a
  ordenação padrão.
- **A lista só é exibida completa.** As páginas da API (100 itens cada) são
  buscadas em sequência, seguindo o cabeçalho `Link` com `rel="next"`, porque
  a API não ordena por estrelas e a ordenação precisa ser global. Se qualquer
  página falhar, a seção inteira entra em erro, sem lista parcial, e tentar de
  novo recomeça da primeira página.
- **Erros de domínio, sem retentativa automática.** O serviço converte cada
  falha em um de quatro tipos: `not-found`, `network`, `rate-limited` e
  `unexpected`. Nenhum deles é repetido sozinho; toda nova tentativa é uma ação
  do usuário. Com limite atingido, a tela mostra o horário de liberação quando
  a API o informa e não oferece botão de tentar novamente.
- **Cache só em memória.** Perfil e repositórios ficam em um reducer
  compartilhado, chaveado pelo login em minúsculas, para que voltar a um perfil
  ou abrir um detalhe a partir da lista não gaste requisições. O cache se perde
  no refresh e nunca é requisito: sem ele, cada rota busca o que precisa na API.
- **Sem token.** Todas as chamadas são GETs anônimos a `https://api.github.com`,
  sem cabeçalho `Authorization` nem segredo no código. O custo é o limite
  público da API (60 requisições por hora por IP), por isso os repositórios só
  são buscados depois que o perfil existe e a aplicação evita repetir chamadas.
- **Respostas obsoletas são descartadas.** Ao trocar de usuário ou sair da tela,
  as requisições em curso são canceladas com `AbortController`, e nenhum dado
  de outro usuário aparece como atual.

### Ajustes de tokens visuais

Os tokens visuais seguem o design system da Vercel (Geist), mapeados no
`@theme` do Tailwind em `src/index.css`. Seis tokens de cor de texto foram
escurecidos para atingir contraste WCAG AA de 4,5:1 sobre os fundos usados:

| Token | Original | Ajustado |
| --- | --- | --- |
| `mute` | `#8f8f8f` | `#636363` |
| `faint` | `#a1a1a1` | `#6b6b6b` |
| `link` | `#0070f3` | `#0761d1` |
| `link-deep` | `#0761d1` | `#0550b0` |
| `error` | `#ee0000` | `#c50000` |
| `error-deep` | `#c50000` | `#a30000` |

## Próximos passos

Depois de instalar, rode `npm run dev` e busque um login, por exemplo
`octocat`. Para conferir a entrega, rode `npm test`, `npm run test:e2e` e
`npm run build`.
