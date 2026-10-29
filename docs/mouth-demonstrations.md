# Demonstrações da Boca 3D

As demonstrações são uma área recolhível acima dos controles manuais, tanto no estúdio quanto na sobreposição da chamada. Nenhum controle manual foi removido. A animação é uma pose temporária calculada no renderizador; parar restaura a posição anterior. Mover manualmente a boca interrompe o exemplo.

## Exemplos

Vibração alveolar contínua, RA com ponta vibrante, toque curto em ARA, LA, TA, DA, PA, BA, MA e S prolongado. O toque curto e a vibrante contínua são tratados separadamente. O modelo continua sendo uma ilustração, sem validação clínica; a indicação e o acompanhamento ficam com a fono.

Há reprodução, pausa, retomada, parada, repetição, mute, volume e velocidades 1×, 0,75× e 0,5×. Os 30 arquivos MP3 sintéticos são gerados offline; as versões lentas preservam a altura da voz. Não há dependência do sintetizador no bundle nem chamadas a APIs de voz. Fontes, geração e hashes estão em `public/audio/mouth3d/README.md` e `manifest.json`.

## Sincronização e áudio

- O protocolo existente `mouth3d_state` transporta um campo opcional `demo`, sem mudança de banco ou de backend.
- O servidor já restringe esse comando ao profissional/admin da chamada; o paciente só recebe os controles.
- O relógio se ancora em `server_now` usando `performance.now()`, reduzindo diferenças entre relógios dos aparelhos. Cada reprodução/retomada tem um ID novo.
- O profissional renova uma autorização de reprodução a cada 1,8 segundo. Ela vence em 5,5 segundos sem renovação. Esse limite também é verificado antes de iniciar um áudio baixado assincronamente.
- Perder a conexão, ocultar a página, sair ou fechar a Boca 3D interrompe o som. Uma autorização antiga não reinicia o paciente após uma interrupção; o profissional deve reproduzir/retomar novamente.
- Pausa e parada são sincronizadas. Não há transmissão de frames de animação nem mistura da demonstração no microfone: cada participante reproduz localmente o mesmo arquivo no mesmo ponto da linha do tempo.
- O áudio usa o contexto já ativado pela chamada e o canal **Atividade** do mixer, além do volume do próprio exemplo. A reprodução reduz a trilha e a música conforme a prioridade já existente, sem mudar o ganho dos microfones.
- Falha ou bloqueio de áudio mostra uma ação para ativar/tentar de novo e não causa uma fila de tentativas ou reprodução tardia após parar.

## Verificação

`node --experimental-strip-types --test tests/mouth-demonstrations.test.ts tests/sessionMouthState.test.ts tests/mouth3d.test.ts tests/session-audio-mix.test.ts tests/session-game-effects.test.ts`

`node tests/mouth-demonstrations.e2e.mjs` com Playwright/Chrome (`PLAYWRIGHT_MODULE` aceita caminho alternativo), Vite em `127.0.0.1:5194`. A fixture da chamada usa dois modelos, áudio Web Audio real e a interface compartilhada de estado. Verifica pausa, retomada, expiração, interrupção segura, manutenção do contexto de áudio e layout no desktop e celulares de 390/320px. Não estabelece uma chamada WebRTC real nem usa pacientes ou dados de produção.

`npm run build`
