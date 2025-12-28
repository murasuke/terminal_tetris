/**
 * 任意の位置に文字を描画するサンプル
 */
export {};
/**
 * 任意の位置に文字を描画する
 * @param {number} x
 * @param {number} y
 * @param {string} chars
 */
function draw(x, y, chars) {
  // 座標(x,y)にcharsを表示
  let str = `\x1b[${y + 1};${x + 1}H${chars}`;
  process.stdout.write(str);
}

draw(1, 1, '██');
draw(3, 1, '██');
draw(5, 2, '██');
