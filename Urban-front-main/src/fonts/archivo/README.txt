Archivo Variable (eixos wdth + wght, subset latin), copiado de @fontsource-variable/archivo 5.3.0 (OFL-1.1).
Fonte original: https://github.com/Omnibus-Type/Archivo. Licenca em OFL.txt.
latin cobre todo o portugues; latin-ext foi omitido porque next/font/local nao suporta unicode-range e carregaria 2 arquivos.
Eixo wdth limitado a 100-125 (fontTools varLib.instancer, wdth=100:125): o produto so usa larguras 100% (normal),
106% (--font-brand-stretch) e 118% (--font-display-stretch); a faixa condensada (62-99) saiu e o arquivo caiu de 90 KB para 62 KB.
Depois do instancer, OS/2.xAvgCharWidth, panose e os extremos de head/hhea foram restaurados do original: o navegador
usa xAvgCharWidth para a largura intrinseca de <input>, entao sem isso os campos mudavam alguns pixels.
Se algum texto precisar de largura menor que 100%, regenere a partir do pacote original sem o limite.
public/og/archivo-og-500.ttf e archivo-og-800.ttf: instancias estaticas (wght 500/800, wdth 100) geradas deste arquivo
com fontTools varLib.instancer, so para a imagem OG (satori nao le woff2 nem fonte variavel). Mesma licenca OFL.
