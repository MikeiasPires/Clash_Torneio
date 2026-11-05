# Indicador de carregamento

`LoadingIndicator` centraliza a imagem, a animação e os anúncios de carregamento.
O capacete mede 36 px nos blocos de conteúdo e 20 px em botões e avisos em linha.
O efeito se inspira no [beat do Loading.io](https://loading.io/animation/),
com dois pulsos por segundo e amplitude reduzida (máximo de 1,12×).
A animação usa apenas CSS local, sem dependência ou CDN, e fica desativada
quando `prefers-reduced-motion: reduce` está ativo.

O texto permanece visível. Em botões, o indicador usa `announce={false}`;
o próprio botão mantém o nome da ação e `aria-busy`. Nos demais lugares,
o indicador anuncia o estado com `role="status"`.

## Imagem

O arquivo enviado continha um quadriculado opaco. O recorte com transparência
foi produzido com a ferramenta integrada ImageGen, preservando o desenho.
O original editado está em `src/assets/loading-helmet.png`; as versões WebP
de 48 e 96 px servidas pelo aplicativo ficam em `public/loading/`.

Prompt utilizado:

> Use case: background-extraction. Edit target: the attached violet fantasy warrior helmet icon. Remove ONLY the baked-in gray and white checkerboard background and convert the entire surrounding background into true transparent alpha, including gaps outside the horn and helmet silhouette. Preserve the helmet exactly: same front view, purple horns, gold trim, violet gemstone, eyes, shapes, colors, and proportions. Keep its subtle violet aura but remove all checkerboard artifacts, even through the outer aura. Center the complete helmet in a square transparent canvas with a little clear padding so the horns are fully visible. No text, no shield, no new objects. This is a small UI loading icon. Output a true transparent cutout.
