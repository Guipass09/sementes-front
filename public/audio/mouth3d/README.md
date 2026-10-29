# Exemplos sonoros da Boca 3D

Áudios sintéticos de demonstração, produzidos offline com eSpeak NG (distribuição WASM `espeak-ng` 1.0.2), voz `pt-br`, por entrada fonética explícita. O aplicativo entrega somente os arquivos MP3 e não depende de serviço de geração de voz.

Referências do gerador:
- https://github.com/espeak-ng/espeak-ng
- https://github.com/ianmarmour/espeak-ng.js
- https://github.com/espeak-ng/espeak-ng/blob/master/phsource/phonemes
- https://github.com/espeak-ng/espeak-ng/blob/master/phsource/ph_pt_brazil

O código fonético `R` seleciona a vibrante alveolar; `*` seleciona o toque alveolar. A variante RA é explicitamente uma demonstração com ponta vibrante e não representa todas as realizações regionais da letra R. TA e DA são exemplos anteriores à vogal A, sem a mudança para as africadas diante de I.

Cada ciclo dura três segundos na velocidade normal. As variantes de 0,75× e 0,5× usam `atempo` do FFmpeg para preservar a altura da voz. Os arquivos são mono, normalizados a -17 LUFS, com limite de pico de -2 dBTP e pequenas transições nas extremidades. Consulte `manifest.json` para as entradas fonéticas e os hashes de cada arquivo.

São exemplos artificiais para apoiar a demonstração visual; não são gravações de uma fono nem validação clínica do modelo. Arquivos de uma profissional podem substituir estes exemplos respeitando a mesma duração e alinhamento.

Reprodução do build: `node scripts/generate-mouth-demo-audio.mjs`, com o módulo WASM disponível em `ESPEAK_MODULE` e FFmpeg no PATH. O gerador e seu código-fonte têm licença GPL-3.0-or-later; o runtime do site não incorpora o gerador.
