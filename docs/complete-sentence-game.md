# Complete a frase

O jogo usa a biblioteca, o editor e o jogador de jogos por rodadas já existentes.

## Criação

- Abra **Jogos → Complete a frase → Novo jogo**.
- Defina nome, descrição e fundo (cor ou imagem, com upload e busca de imagens existentes).
- Escreva a frase da rodada. Cada grupo de sublinhados (`_`, `___`) representa uma lacuna. **Inserir lacuna** usa a posição do cursor.
- Adicione figuras e escreva a palavra de cada uma. Selecione a resposta de cada lacuna em ordem. Uma figura pode ser a resposta de mais de uma lacuna.
- Adicione as demais rodadas e confira a prévia antes de salvar. O jogo salvo tem as mesmas ações de jogar, editar, enviar e compartilhar com profissionais.

O servidor verifica as imagens, o autor e o vínculo dos pacientes. Nenhuma rodada incompleta é salva. Os limites de segurança são 100 rodadas, 100 figuras por rodada e 30 lacunas por frase.

## Jogar

A lacuna atual fica destacada. Uma resposta correta insere a palavra da figura; um erro preserva as respostas anteriores. A frase completa permanece visível por 1,6 segundo antes da próxima rodada. Na última, abre o modal de conquista padrão com o som de conclusão. O jogador permite refazer a rodada e reiniciar o jogo.

A grade usa até seis colunas no desktop, quatro em tablets e duas ou três em telas menores. As figuras mantêm o mesmo tamanho na linha, mostram a imagem inteira e permitem rolagem em telas baixas.

## Sessão ao vivo

O jogo aparece no catálogo da chamada e no seletor de histórias completas. O paciente entra no jogador em pseudo fullscreen e só interage após a liberação de controle pelo profissional. Cada escolha inclui a rodada e o índice da lacuna; um evento repetido não preenche outra lacuna. O profissional controla a troca automática de rodada e transmite o mesmo evento ao paciente. Acertos, erros e conclusão usam o sistema de efeitos e mixer da chamada.

O novo tipo é `sentence`, com `blank_answers` na estrutura JSON de cada rodada, rota `/jogos/complete-frase/:id` e identificador `complete_sentence_game`. Não há migração de banco. Publicar primeiro o suporte no backend e depois o frontend.

## Verificação

- `node --experimental-strip-types --test tests/round-game.test.ts tests/sessionGameEvent.test.ts tests/game-audio.test.ts`
- `node tests/complete-sentence.e2e.mjs` (Playwright/Chrome e servidor Vite em `127.0.0.1:5194`; `PLAYWRIGHT_MODULE` pode apontar para o módulo instalado).
- Backend: `php -d extension=pdo_sqlite -d extension=sqlite3 vendor/phpunit/phpunit/phpunit --bootstrap tests/bootstrap.php tests/Feature/RoundGamesTest.php`.
- `npm run build`.

O teste do navegador usa fixtures locais de API, sem criar pacientes ou modificar dados de produção. O teste da sessão monta dois iframes e retransmite eventos pela interface usada na chamada; não estabelece uma conexão WebRTC real.
