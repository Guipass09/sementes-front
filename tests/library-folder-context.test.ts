import assert from 'node:assert/strict';
import test from 'node:test';
import { creationFolder, folderReturnPath } from '../src/features/library-folders/creation-context.ts';

test('only allowlisted create requests carry folder context; uploads/edits/shares/payments never do', () => {
  for (const prefix of ['admin', 'professional']) {
    for (const resource of ['activities', 'memory-games', 'phoneme-games', 'auditory-games', 'hangman-games', 'spin-wheel-games', 'word-search-games', 'card-games', 'guess-image-games']) {
      const path = `/api/${prefix}/${resource}`;
      assert.equal(creationFolder(path, 'POST', '?pasta=21'), 21);
      assert.equal(creationFolder(path, 'GET', '?pasta=21'), null);
      assert.equal(creationFolder(`${path}/3`, 'PATCH', '?pasta=21'), null);
      assert.equal(creationFolder(`${path}/3/assignments`, 'POST', '?pasta=21'), null);
    }
  }
  assert.equal(creationFolder('/api/round-games', 'POST', '?pasta=21'), 21);
  for (const path of ['/api/round-game-assets', '/api/activity-images/import', '/api/professional/activities/2/media', '/api/video/command', '/api/payments/create']) assert.equal(creationFolder(path, 'POST', '?pasta=21'), null);
});

test('invalid identifiers do not become creation context or redirect targets', () => {
  for (const query of ['', '?pasta=0', '?pasta=-2', '?pasta=hello', '?pasta=2.5', '?pasta=9007199254740999']) {
    assert.equal(creationFolder('/api/round-games', 'POST', query), null);
    assert.equal(folderReturnPath('/normal', 'professional', query), '/normal');
  }
});

test('creation returns to the correct staff folder without changing ordinary flows', () => {
  assert.equal(folderReturnPath('/game/3', 'professional', '?pasta=21'), '/profissional/pastas/21');
  assert.equal(folderReturnPath('/game/3', 'admin', '?pasta=21'), '/admin/pastas/21');
  assert.equal(folderReturnPath('/game/3', 'user', '?pasta=21'), '/game/3');
  assert.equal(folderReturnPath('/game/3', 'admin', ''), '/game/3');
});
