# Guia de Deploy no Vercel

## Pré-requisitos

1. Conta no GitHub (repositório do projeto)
2. Conta no Vercel (vercel.com)
3. Domínio customizado registrado

## Passo 1: Preparar o Repositório GitHub

```bash
# Inicializar repositório Git (se ainda não existir)
git init
git add .
git commit -m "Initial commit: FutGestão"
git branch -M main
git remote add origin https://github.com/seu-usuario/futgestao.git
git push -u origin main
```

## Passo 2: Criar Conta no Vercel

1. Acesse https://vercel.com
2. Clique em "Sign Up"
3. Escolha "Continue with GitHub"
4. Autorize o Vercel a acessar seus repositórios

## Passo 3: Importar Projeto no Vercel

1. No dashboard do Vercel, clique em "New Project"
2. Selecione o repositório "futgestao"
3. Configure as variáveis de ambiente:

```
DATABASE_URL=sua_database_url
JWT_SECRET=sua_jwt_secret
VITE_APP_ID=seu_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=seu_owner_id
OWNER_NAME=seu_nome
BUILT_IN_FORGE_API_URL=sua_api_url
BUILT_IN_FORGE_API_KEY=sua_api_key
VITE_FRONTEND_FORGE_API_KEY=sua_frontend_key
VITE_FRONTEND_FORGE_API_URL=sua_frontend_url
VITE_APP_TITLE=Footbreja app
VITE_APP_LOGO=sua_logo_url
VITE_ANALYTICS_ENDPOINT=seu_analytics_endpoint
VITE_ANALYTICS_WEBSITE_ID=seu_analytics_id
```

4. Clique em "Deploy"

## Passo 4: Configurar Domínio Customizado

1. No dashboard do Vercel, vá para "Settings" → "Domains"
2. Clique em "Add"
3. Digite seu domínio: `footgest.wbg-app.com.br`
4. Siga as instruções para configurar os registros DNS

### Registros DNS Necessários

- **Tipo A:** `footgest` → IP do Vercel (será fornecido)
- **Tipo CNAME:** `www.footgest` → `cname.vercel-dns.com.`

## Passo 5: Testar Deploy

1. Acesse seu domínio customizado
2. Verifique se o SSL foi gerado automaticamente (🔒)
3. Teste todas as funcionalidades

## Troubleshooting

### Deploy falha com erro de build
- Verifique se todas as variáveis de ambiente estão configuradas
- Verifique se o `package.json` tem os scripts corretos
- Verifique os logs do Vercel

### Domínio não funciona
- Aguarde propagação DNS (até 48 horas)
- Verifique se os registros DNS estão corretos
- Limpe cache do navegador

### SSL não foi gerado
- Aguarde 24 horas
- Verifique se o domínio está resolvendo corretamente
- Contate suporte do Vercel

## Próximas Ações

Após deploy bem-sucedido:
1. Atualizar link de convite no código (se necessário)
2. Testar fluxo completo com usuários reais
3. Monitorar logs e performance
4. Configurar CI/CD para deploy automático

## Suporte

- Documentação Vercel: https://vercel.com/docs
- Suporte Vercel: https://vercel.com/support
