# Pastas da biblioteca

Profissionais e administradores organizam os materiais em **Minhas pastas**, disponível nos menus de atividades e jogos. Cada pasta pode reunir slides, vídeos, histórias completas e qualquer tipo de jogo. O botão com ícone de pasta nas bibliotecas move um material para outra pasta ou para **Sem pasta**. Excluir uma pasta nunca exclui o conteúdo.

As pastas são pessoais: organizar um material recebido não muda a biblioteca de quem o criou, os compartilhamentos ou os pacientes atribuídos. A verificação de acesso continua no servidor; uma associação de pasta não concede acesso a um material. Recursos apagados ou cujo compartilhamento foi revogado deixam de aparecer.

Na chamada, as pastas aparecem antes das categorias, em ordem alfabética, respeitando **Meu catálogo** e **Compartilhados**. Só as listas de apresentação são filtradas: os arrays completos de atividades continuam disponíveis para resolver as etapas de histórias. Se a consulta de pastas falhar, o catálogo avulso permanece acessível e oferece nova tentativa.

Ao criar dentro de uma pasta, `?pasta=<id>` acompanha os formulários existentes. Apenas os POSTs de criação recebem `library_folder_id`; uploads, edições, compartilhamentos, atribuições e sinalização de chamada não recebem o campo. O middleware valida a pasta e grava a associação na mesma transação que cria o recurso. Após salvar, o fluxo retorna à pasta.

Backend: migração aditiva `2026_10_29_210000_create_library_folders.php`; endpoints autenticados `/api/library/folders` e `/api/library/folder-items`. Implantar backend e migração antes do frontend. A autorização de acesso e a exigência de assinatura permanecem vigentes.

Validação: `tests/Feature/LibraryFoldersTest.php` e `RoundGamesTest.php` no backend; `tests/library-folder-context.test.ts`, `tests/resource-navigation.test.ts` e `tests/library-folders.e2e.mjs` no frontend. Os testes de navegador usam a aplicação real com API simulada, incluindo o catálogo da chamada; não representam um atendimento real com paciente.
