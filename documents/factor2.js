/**
 * キー押下した位置に押された矢印を表示する
 */
export {};

let x = 0;
let y = 0;
process.stdout.write('\x1b[?25l'); // カーソルを非表示
process.stdin.setRawMode(true); // stdin.on('data')でEnterを待つことなくキー入力を取得可能に
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  let c = '';
  if (key === '\u0003') process.exit();
  if (key === '\u001b[D') {
    x = x - 1;
    c = '←';
  } else if (key === '\u001b[C') {
    x = x + 1;
    c = '→';
  } else if (key === '\u001b[B') {
    y = y + 1;
    c = '↓';
  } else if (key === '\u001b[A') {
    y = y - 1;
    c = '↑';
  }
  draw(x, y, c);
});

function draw(x, y, chars) {
  // 座標(x,y)にcharsを表示
  let str = `\x1b[${y + 1};${x + 1}H${chars}`;
  process.stdout.write(str);
}
