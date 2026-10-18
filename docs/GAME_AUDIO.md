# Audio dos jogos

## Comportamento

- Jogos de memoria (classico e 2.0), fonemas, escuta, forca, roleta, cartas,
  caca-palavras, acerte a imagem, sons/imagens e sequencia usam a faixa
  instrumental infantil "Children's March Theme", de Cleyton Kauffman, publicada
  como CC0. OGG e MP3 estao incluidos no projeto; fonte, licenca e hashes em
  `public/audio/CREDITS.md`. OGG e preferido para o loop, com MP3 como fallback
  em navegadores sem suporte a Vorbis.
- A marchinha entra suavemente nos primeiros 1,5 segundos, sem vinheta
  separada. Reativar o som retoma o ponto atual, sem reiniciar a musica
  ou repetir a entrada a cada volta do loop.
- A barra permite volume de 0 a 100%, com nivel inicial de 35% salvo no
  navegador. Esse nivel aplica ganho suave de 14% a musica e aos efeitos.
  O mute preserva o nivel escolhido.
  Pode ser necessario o primeiro toque para liberar audio.
- A musica usa um unico elemento de audio, sem sintetizar notas ou decodificar
  a faixa inteira em memoria. Nao ha requisicao ao site do autor em runtime.
- O botao de alto-falante silencia trilha, efeitos, voz dos fonemas e midia
  do documento de gameplay. A escolha normal e salva localmente.
- Trocar de jogo, ocultar a aba ou silenciar interrompe a trilha. Reativar nao
  sobrepoe loops nem reinicia a musica do mesmo jogo.
- O botao acompanha o fullscreen nativo e o pseudo fullscreen.
- Historias mantem o audio dos slides e encaminham o mesmo estado para os
  jogos embutidos; nao ha trilha simultanea no documento pai.

## Atendimento ao vivo

- Toda nova entrada comeca com os jogos silenciados, independentemente da
  preferencia de uso individual.
- O profissional usa o alto-falante no cabecalho da chamada. A escolha e
  encaminhada para seu iframe e para o paciente pelo canal existente.
- O evento `game_audio` recebe `{ muted: boolean, volume: number }` (volume
  normalizado entre 0 e 1). O cliente do paciente so
  aceita mensagens identificadas pelo servidor com `from: admin` e posteriores
  a sua entrada. O cliente envia novamente o estado quando o paciente confirma
  que o conteudo abriu e quando o profissional entra.
- Arrastar a barra atualiza a previa local; soltar, usar o teclado ou sair do
  controle confirma o nivel para o paciente, sem enviar um comando por pixel.
  Falha de envio restaura a ultima configuracao confirmada. Pacientes nao
  enviam configuracoes de som ao profissional.
- O iframe so aceita estado do pai com origem e janela correspondentes.
- Microfone, tracks WebRTC e o video remoto nao sao alterados. A aplicacao de
  mute em elementos HTML acontece apenas no documento de gameplay, nunca no
  documento da chamada.
- Nao exige alteracao de backend, migracao ou variavel de ambiente. O canal de
  comandos existente ja aceita o evento e identifica seu remetente.

## Reacoes na chamada

- O menu Reacoes substitui Confetes no mesmo local: confetes, palmas, coracoes,
  carinhas felizes e mensagem personalizada de ate 32 caracteres.
- Cada opcao tem seu som: fanfarra existente, palmas sintetizadas, notas suaves,
  melodia alegre ou brilho musical. Todos respeitam o mute e o volume, inclusive
  durante a reproducao. O menu oferece o mesmo controle de som do cabecalho.
- A chamada continua iniciando silenciada. O profissional pode ativar o som no
  menu Reacoes mesmo antes de abrir um jogo. Microfone e video nao sao alterados.
- `session_reaction` compartilha `{ id, type, seed, text? }` no canal de comandos
  existente. Apenas mensagens identificadas pelo servidor como `admin`, posteriores
  a entrada atual e com payload valido sao aceitas. Confetes antigos continuam
  sendo aceitos. O frontend nao exige novo endpoint nem variavel de ambiente.
- A semente preserva a distribuicao entre participantes; o identificador evita
  duplicar o efeito ao receber o eco do proprio comando. O menu permanece aberto a
  cada clique e permite ate quatro envios em andamento, sem esperar cada resposta.
  Ate seis efeitos coexistem (no maximo 480 particulas), cada um por 4,2 segundos.
  Exceder esse limite remove o mais antigo, sem reiniciar os demais. Timers sao
  removidos ao sair. Os sons continuam se substituindo para nao somar volume.
- Mensagens sao renderizadas como texto, nunca HTML. Em areas estreitas, a mensagem
  usa duas colunas. Quem prefere movimento reduzido ve apenas a mensagem estatica
  mais recente, sem sobrepor textos.

## Testes Das Reacoes

`node --experimental-strip-types --test tests/session-reactions.test.ts`

O teste `tests/session-reactions.render.tsx` usa o mesmo esbuild dos controles,
com `--loader:.css=empty`, seguido de `node --test`.

## Testes Do Audio

`node --experimental-strip-types --test tests/game-audio.test.ts tests/game-audio-volume.test.ts tests/sessionGameEvent.test.ts tests/round-game.test.ts`

Para o controle renderizado, compilar `tests/game-audio-controls.render.tsx`
com esbuild e executar o modulo resultante com `node --test`, seguindo as
opcoes dos testes de cards existentes (alias `@`, JSX automatico e env vazio).

Validacao manual: abrir jogo, tocar uma vez caso o navegador exija, silenciar
durante efeito/fala, trocar de jogo, alternar aba, abrir fullscreen e testar
dois participantes na chamada. Conferir voz da chamada independente do som
do jogo, mute inicial e ressincronizacao apos recarregar um participante.
