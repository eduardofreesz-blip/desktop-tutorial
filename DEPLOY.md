# Como fazer deploy das alterações

Se o bot "não mudou nada" após as correções, o servidor ainda está rodando a versão antiga. Siga estes passos **no servidor** (SSH):

## 1. Conectar no servidor
```bash
ssh root@SEU_IP
# ou
ssh usuario@SEU_IP
```

## 2. Ir para a pasta do projeto
```bash
cd /var/www/universal_recargas
```
*(Ajuste o caminho se seu projeto estiver em outro lugar)*

## 3. Executar o deploy
```bash
git pull origin main
yarn build
pm2 restart all
```

**Ou use o script:**
```bash
bash scripts/deploy.sh
```

## 4. Verificar se funcionou
- **Opção A:** Envie "Oi" no WhatsApp. O menu deve mostrar **"Digite o número da opção"** e no final algo como **_v2_** ou **_build-abc1234_**
- **Opção B:** Acesse no navegador: `https://SEU_DOMINIO/api/deploy-info` — deve retornar o commit atual

## Se ainda não mudou
1. Confirme o diretório: `pwd` deve mostrar o caminho do projeto
2. Confirme o pull: `git log -1` deve mostrar o commit mais recente
3. Confirme o build: deve existir a pasta `.next` com arquivos
4. Confirme o PM2: `pm2 list` — o app deve estar "online"
5. Se usar Evolution API: verifique se está ativada e o webhook aponta para o servidor correto
