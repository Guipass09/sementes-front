# 📋 Comandos Prontos para Frontend - Copiar e Colar

## 🔧 1. Adicionar variável de ambiente

### Se estiver usando arquivo .env.local:
```bash
cd /Users/darissafreitas/Documents/sementes-front
echo "VITE_ONESIGNAL_APP_ID=seu_app_id_aqui" >> .env.local
```

### Ou edite manualmente:
```bash
nano .env.local
# ou
vim .env.local
```

**Adicione esta linha:**
```env
VITE_ONESIGNAL_APP_ID=seu_app_id_aqui
```
*(Use o MESMO App ID do backend!)*

---

## 🚀 2. Se estiver usando Vercel/Netlify

### Vercel:
1. Acesse: https://vercel.com
2. Vá no seu projeto
3. **Settings** > **Environment Variables**
4. Adicione:
   - **Name:** `VITE_ONESIGNAL_APP_ID`
   - **Value:** Seu App ID do OneSignal
5. Clique em **Save**
6. Faça um novo deploy (ou aguarde o próximo)

### Netlify:
1. Acesse: https://app.netlify.com
2. Vá no seu projeto
3. **Site settings** > **Environment variables**
4. Adicione:
   - **Key:** `VITE_ONESIGNAL_APP_ID`
   - **Value:** Seu App ID do OneSignal
5. Clique em **Save**
6. Faça um novo deploy

---

## 🔄 3. Rebuild (se necessário)
```bash
npm run build
```

---

## ✅ 4. Verificar

Abra o console do navegador (F12) e verifique:
- Deve aparecer: `OneSignal player ID registrado: ...`
- Se aparecer erro, verifique se `VITE_ONESIGNAL_APP_ID` está configurado

---

## 📝 RESUMO RÁPIDO

```bash
# Adicionar variável
cd /Users/darissafreitas/Documents/sementes-front
echo "VITE_ONESIGNAL_APP_ID=seu_app_id" >> .env.local

# Rebuild (se necessário)
npm run build
```

**Pronto! Frontend configurado! 🎉**
