# SCCS — Sistema de Controle de Coleta Seletiva

O **SCCS (Sistema de Controle de Coleta Seletiva)** é uma aplicação web desenvolvida em React para controle, registro e gestão de processos de reciclagem e coletas sustentáveis. O projeto gerencia desde o cadastro de clientes e colaboradores até o recebimento de resíduos em depósitos e envio de cargas de materiais para empresas terceirizadas de reciclagem.

---

## 🚀 Como Executar o Projeto

Como o sistema foi construído utilizando scripts carregados via CDN e transpilados em tempo de execução no navegador com **Babel Standalone**, a execução é extremamente simples.

### Opção 1: Execução Direta (Sem Servidor)
1. Dê um duplo clique ou abra o arquivo [index.html](index.html) em qualquer navegador web moderno (Chrome, Edge, Firefox, etc.).
2. O sistema utilizará o `localStorage` do navegador para simular a base de dados.

### Opção 2: Servidor de Desenvolvimento Local (Recomendado)
Para uma experiência de desenvolvimento mais fluida ou para evitar problemas de CORS em algumas políticas rígidas do navegador, você pode usar um servidor local simples:
* **VS Code Live Server**: Instale a extensão "Live Server" e clique em **Go Live**.
* **Python**: Execute o comando abaixo no terminal da raiz do projeto:
  ```bash
  python -m http.server 8000
  ```
  Depois, acesse `http://localhost:8000` no seu navegador.

---

## 🛠️ Tecnologias Utilizadas

* **Núcleo do Front-end**: [React 18](https://react.dev/) (carregado via CDN em formato UMD).
* **Renderização Dinâmica**: [Babel Standalone](https://babeljs.io/docs/babel-standalone) (configurado para usar o runtime clássico do JSX e transpile de ES6).
* **Interface Visual e Design**: [Bootstrap 5.3.3](https://getbootstrap.com/) (para CSS de layout responsivo, modais e componentes de formulário).
* **Base de Dados**: `localStorage` do navegador (pré-alimentado com dados de semente para demonstração inicial).

---

## 📌 Requisitos Funcionais Implementados (RF)

### 👥 Cadastros Gerais (RF01 a RF24)
O sistema possui uma central completa de Cadastros (tipo CRUD - Criar, Ler, Atualizar e Deletar) com as seguintes entidades:
*   **Clientes**: Controle de nome, CPF, e-mail, telefone, rua, número e bairro de residência.
*   **Colaboradores**: Registro de funcionários e sua carga horária.
*   **Materiais**: Tipagem dos resíduos recicláveis (ex: Papel, Vidro, Plástico, Metal) e seus estados.
*   **Bairros**: Mapeamento das regiões de coleta, população aproximada e proximidades.
*   **Cargos**: Definição da hierarquia funcional e salários.
*   **Depósitos**: Cadastro de filiais físicas e seus CNPJs.
*   **Empresas**: Registro de corporações de reciclagem terceirizadas parceiras.

### 📋 Fluxo de Coleta e Regras de Negócio
1.  **Pedido de Coleta (RF01)**:
    *   Registra a quantidade em Kg e o volume em m³ de material solicitado por um cliente.
    *   *Regra de Validação*: Um cliente só pode solicitar no máximo **100 Kg do mesmo material por mês** e realizar no máximo **10 pedidos de coleta por mês**.
2.  **Envio de Materiais (RF02)**:
    *   Registra a transferência de resíduos recicláveis em estoque para uma empresa terceirizada.
    *   *Regra de Validação*: Só é permitido despachar um material caso o estoque em depósito seja **igual ou superior a 100 Kg**.
    *   *Regra de Validação*: Cada empresa terceirizada só pode receber **um único tipo de material** associado a ela.
3.  **Recebimento de Materiais (RF03)**:
    *   Registra a chegada física da coleta ao depósito associada a um código de identificação.
    *   *Regra de Validação*: Apenas colaboradores cadastrados com o cargo de **Gestor** têm permissão para registrar recebimentos. O ID da coleta deve ser único.

### 📈 Relatórios Estatísticos e Gerenciais (RF04 a RF09)
Seção dedicada a exibição de dados com filtros flexíveis de período (Mês Início / Mês Fim):
*   **RF04 — Materiais Coletados**: Lista e totaliza os pesos e volumes coletados.
*   **RF05 — Utilização dos Bairros**: Classifica os bairros com maior volume de requisições de coleta.
*   **RF06 — Pedidos de Coleta**: Consolida todos os pedidos efetuados por clientes no período.
*   **RF07 — Materiais no Depósito**: Exibe o estoque atual de cada tipo de resíduo (Recebimentos menos Envios).
*   **RF08 — Materiais Enviados**: Histórico de transferências efetuadas para empresas parceiras.
*   **RF09 — Clientes Novos**: Lista os novos clientes integrados à plataforma no período selecionado.

---

## 🧪 Suíte de Testes Automatizados E2E (Ponta a Ponta)

O projeto conta com testes de validação automatizados usando o framework **Puppeteer** (Chromium automatizado) para garantir que todas as regras e botões do sistema funcionem sem erros de sintaxe ou de lógica.

### Pré-requisitos para os Testes
Certifique-se de ter o **Node.js** instalado na sua máquina (recomendado versão 18 ou superior).

### Como Rodar os Testes
1. Abra um terminal e navegue para a pasta de testes:
   ```bash
   cd test-sandbox
   ```
2. Instale as dependências (Puppeteer):
   ```bash
   npm install
   ```
3. Execute o script de testes:
   ```bash
   node run_tests.js
   ```

### Resultados Gerados pelos Testes
Ao final da execução, a suíte de testes gerará automaticamente:
*   [test_results.json](test-sandbox/test_results.json): Arquivo de logs em formato JSON detalhando cada assertiva dos testes (Páginas, CRUDs, Validações de Regra de Negócio e Responsividade).
*   `desktop_dashboard.png`: Captura de tela da renderização do sistema em formato Desktop (computadores).
*   `mobile_dashboard.png`: Captura de tela da renderização em formato Mobile (smartphones), validando o cabeçalho adaptável.
