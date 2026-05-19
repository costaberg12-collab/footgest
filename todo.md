# Project TODO

- [x] Cadastro de jogadores com classificação por tipo: linha, goleiro ou ambos.
- [x] Controle de presença por jogador com status confirmado, pendente e não vai.
- [x] Regra de prazo de confirmação até sexta-feira às 18h.
- [x] Registro do horário de confirmação de presença.
- [x] Exibição da regra de chegada 15 minutos antes do jogo.
- [x] Gerenciamento de convidados por jogador, com nome, valor por dia e vínculo com quem convidou.
- [x] Regra de liberação de convidados somente após a confirmação dos mensalistas.
- [x] Registro financeiro automático dos convidados.
- [x] Controle financeiro de mensalidades com status pendente, enviado com comprovante e confirmado.
- [x] Envio de comprovante pelo jogador e confirmação ou rejeição pelo administrador.
- [x] Registro de despesas por categoria: campo, materiais e outros.
- [x] Cálculo automático do saldo do grupo.
- [x] Formação automática de times por ordem de chegada.
- [x] Suporte aos times A, B, C, D e fila de espera.
- [x] Regra de composição 5 jogadores de linha + 1 goleiro ou 6 jogadores sem goleiro.
- [x] Regras automáticas para goleiros: dois fixos, um titular com improvisado, ou todos de linha.
- [x] Lista fixa de árbitros autorizados definida manualmente.
- [x] Seleção automática de três jogadores fora do jogo para árbitro 1, árbitro 2 e mesário.
- [x] Rodízio automático de arbitragem.
- [x] Controle de jogo pelo mesário com cronômetro, gols e cartões.
- [x] Estatísticas de artilheiros, cartões, presença e histórico de partidas.
- [x] Painel web administrativo para gestão completa.
- [x] Aplicativo responsivo para jogadores usarem pelo celular.
- [x] Testes automatizados para regras principais do sistema.
- [x] Validação de build e status do ambiente antes da entrega.
- [x] Checkpoint final do projeto para disponibilização ao usuário.

## Modelo de dados planejado

O sistema será organizado em torno de jogadores, partidas semanais, confirmações de presença, convidados, pagamentos, despesas, times, arbitragem, eventos de jogo e estatísticas. As regras críticas serão centralizadas no backend para manter consistência entre painel web e experiência mobile.

| Área | Entidades principais | Regra-chave |
| --- | --- | --- |
| Jogadores | jogadores, usuários | Tipo do atleta e status de participação |
| Presença | partidas, confirmações | Prazo de sexta-feira às 18h e ordem de chegada |
| Convidados | convidados, receitas | Liberação após controle dos mensalistas |
| Financeiro | pagamentos, despesas | Saldo = receitas confirmadas - despesas |
| Times | times, escalações | Times gerados automaticamente por chegada e goleiros |
| Arbitragem | árbitros autorizados, escala | Três jogadores fora da partida em rodízio |
| Jogo | eventos de partida | Gols e cartões registrados pelo mesário |
| Estatísticas | rankings e histórico | Dados consolidados por jogador e partida |

## Ajustes finais antes da entrega

- [x] Implementar e testar bloqueio real de confirmação de presença após sexta às 18h, com mensagem de erro clara.
- [x] Adicionar fila de espera explícita no backend e na interface para jogadores e convidados fora dos times gerados.
- [x] Cobrir e ajustar os cenários de goleiros: dois fixos, um fixo com improvisado e zero goleiros.
- [x] Completar o cronômetro do mesário com tempo persistido, iniciar, parar, retomar e refletir estado salvo da partida.
- [x] Garantir proteção de backend para ações administrativas com validação de perfil de administrador.
- [x] Adicionar testes automatizados para presença, pagamentos, despesas, estatísticas e mutações principais do sistema.

## Lacunas técnicas detectadas na revisão final

- [x] Adicionar teste explícito para o cenário de formação com um goleiro fixo e outro time com goleiro improvisado.
- [x] Inspecionar e, se necessário, ajustar a interface Home.tsx para comprovar uso do clockSeconds e clockRunning persistidos com iniciar, pausar, retomar e refletir estado salvo.
- [x] Ampliar os testes do router para cobrir createGuest, reviewPayment, generateTeams, assignReferees e recordEvent.

- [x] Mostrar evidência verificável do Home.tsx ou ajustar a UI para comprovar que o cronômetro usa clockSeconds e clockRunning persistidos, com iniciar, pausar, retomar e estado salvo refletido na interface.

## Ajuste solicitado pelo usuário em 2026-05-09

- [x] Na tela do jogador, substituir as três opções de presença por apenas dois botões: **Presença** em verde e **Ausência** em vermelho, mantendo **Pendente** apenas como estado automático interno quando o jogador não escolher nenhuma opção.

## Correção complementar de visibilidade de presença

- [x] Ocultar qualquer badge ou texto visual de **Pendente** na tela do jogador, mantendo esse status apenas como estado interno quando não houver resposta.
- [x] Diferenciar a renderização da área de presença para que o jogador veja somente seu próprio controle com **Presença** e **Ausência**, enquanto o administrador mantém visão geral de acompanhamento.

## Melhorias solicitadas em 2026-05-09: QR Code, configurações e cronômetro

- [x] Implementar teste inicial de chegada por **QR Code**, permitindo que o administrador gere um código da rodada e que o jogador registre chegada real somente por esse fluxo.
- [x] Permitir ao administrador lançar o **saldo inicial em caixa** já existente, para que o saldo do grupo some esse valor às receitas e despesas registradas.
- [x] Criar área administrativa de **configurações da turma**, com edição de horários do jogo, prazo de confirmação e regra de chegada antecipada.
- [x] Criar opção administrativa para editar a **descrição do aplicativo** exibida na tela principal.
- [x] Criar opção administrativa para personalizar **cores principais** do aplicativo.
- [x] Criar espaço administrativo para configurar uma **logo da turma**, inicialmente por URL, para aparecer no topo do FutGestão.
- [x] Remover os botões de ajuste manual de **-1 minuto** e **+1 minuto** do cronômetro.
- [x] Revisar e corrigir o cronômetro para iniciar em estado coerente, sem começar indevidamente com aproximadamente 2 minutos.

## Melhorias adicionais solicitadas

- [x] Adicionar botão **"Baixar QR Code"** na interface de configurações que permite salvar apenas a imagem do QR Code em PNG, sem salvar a página inteira.
- [x] Implementar painel de **Configurações** completo com edição de nome do app, descrição, cores primária e secundária, saldo inicial em caixa, horários do jogo e chegada, e upload de logo do grupo.
- [x] Implementar análise automática de cores da logo: após upload, o app extrai as 2 cores dominantes e sugere como primária e secundária, com opção de aplicar ou escolher manualmente.
- [x] Remover fundo branco da logo PNG: agora exibe com fundo transparente tanto no cabeçalho quanto nas configurações.
- [x] Corrigir problema de mudanças voltarem sozinhas nas configurações: agora as mudanças permanecem até o usuário salvar ou sair do formulário.
- [x] Corrigir atualização de horários no cabeçalho: após salvar as configurações, o cabeçalho agora atualiza corretamente com os novos horários.
- [x] Corrigir atualização de horários: agora quando você salva as configurações de horário, a partida atual é atualizada com os novos horários (confirmação, chegada, etc.).

## Novas funcionalidades solicitadas

- [x] Adicionar campo de regulamento nas configurações do admin (textarea para editar)
- [x] Criar tela de aceitar regulamento na primeira vez para novos jogadores
- [x] Implementar sistema de múltiplos agendamentos de jogo por semana (segunda, quarta, sexta, etc.)
- [x] Criar partidas automaticamente baseado nos agendamentos
- [x] Implementar tela de confirmação de chegada via QR Code
- [x] Permitir que o QR Code registre a hora exata de chegada do jogador

## Bugs Encontrados

- [x] Horários não atualizam após salvar nas configurações (continuam com valores antigos) - CORRIGIDO: updateSettings agora atualiza partidas com status 'in_progress' além de 'scheduled'
- [x] Horário de confirmação deve ser no mesmo dia do jogo (atualmente está no dia anterior)
- [x] Campo de horário de confirmação deve ser editável (permitir escolher hora e minuto) - CORRIGIDO

## Funcionalidades administrativas solicitadas

- [x] Implementar seção de Gerenciamento de Admins nas Configurações
- [x] Permitir admin promover/remover outros admins na aplicação
- [x] Adicionar coluna role à tabela players
- [x] Criar procedures tRPC para promover/remover admins
- [x] Botão de Painel de Controle visível apenas para o fundador
- [x] Domínio customizado wbgsolutions.com.br configurado no Registro.br
- [x] Registros DNS A e CNAME adicionados no Registro.br
- [x] Remover todas as referências ao "Manus" da interface
- [x] Configurar domínio customizado nos servidores do Manus


## Novas funcionalidades em desenvolvimento (2026-05-17)

- [x] Sistema de convite por email para novos jogadores
- [x] Validação de email com feedback claro quando jogador não está cadastrado
- [x] Dashboard de estatísticas pessoais do jogador
- [x] Cálculo de média de gols por partida (gols / partidas que compareceu)
- [ ] Integração com WhatsApp para enviar convites no grupo


## Informações Críticas do Projeto (NÃO ESQUECER)

- **Admin Email:** costaberg12@gmail.com
- **Domínio anterior 1:** wbgsolutions.com.br (não propagou - DESCONTINUADO)
- **Domínio anterior 2:** wbg-engtech.com.br (trocado por subdomínio - DESCONTINUADO)
- **Novo domínio:** footgest.wbg-app.com.br (ATIVO - EM PROGRESSO)
- **Domínio principal:** wbg-app.com.br (registrado e ativo)
- **Configuração DNS do novo subdomínio:**
  - Registro A: `footgest` → 104.21.16.89 ✅
  - Registro CNAME: `www.footgest` → footgest.wbg-app.com.br ✅
  - Registrador: wbg-app.com.br
  - Status: Configurado, aguardando propagação
- **IP do servidor:** 104.21.16.89 (fornecido por mim)
- **App Name:** FutGestão / Footbreia app
- **User NÃO tem acesso ao Management UI do Manus** - EU preciso fazer todas as configurações
- **Não implementar integração com WhatsApp por enquanto** (planejado para futuro)
- **Gerenciar a atividade de domínio até o fim** - não deixar incompleto


## Configuração do Novo Subdomínio footgest.wbg-app.com.br (EM PROGRESSO)

- [x] Atualizar arquivo domain-config.json com novo subdomínio (footgest.wbg-app.com.br) ✅
- [x] Configurar registros DNS no registrador de wbg-app.com.br ✅
- [x] Verificar propagação DNS (100% propagado globalmente) ✅
- [x] Domínio resolvendo corretamente para 104.21.16.89 ✅
- [ ] Gerar certificado SSL para footgest.wbg-app.com.br (CRÍTICO - EM PROGRESSO)
- [ ] Vincular domínio customizado no painel do Manus
- [ ] Testar acesso pelo novo subdomínio com HTTPS
- [ ] Atualizar documentação do projeto
- [ ] Confirmar que tudo está funcionando

**Status atual:** DNS ✅ | Resolução ✅ | SSL ⏳ (ERR_SSL_VERSION_OR_CIPHER_MISMATCH)
