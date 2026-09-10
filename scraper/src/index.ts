const url =
  'https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026';

const response = await fetch(url);

const text = await response.text();

const index = text.indexOf('"cod_time"');

console.log(text.slice(index - 100, index + 1000));