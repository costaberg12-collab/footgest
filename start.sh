#!/bin/bash

# Carregar variáveis do .env.production se existir
if [ -f .env.production ]; then
  export $(cat .env.production | grep -v '#' | xargs)
fi

# Iniciar a aplicação
exec node dist/index.js
