/**
 * 任意の位置に文字を描画するサンプル
 */
export {};
/**
 * 任意の位置に文字を描画する(色指定を追加)
 * @param {number} x
 * @param {number} y
 * @param {string} chars
 * @param {string} color - ANSIカラーコード（例: '31' や 31）
 */
function draw(x, y, chars, color = '30') {
  // 座標(x,y)にcharsを表示(xは2倍してセル幅に合わせる)
  let str = `\x1b[${color}m\x1b[${y};${x * 2}H${chars}`;

  process.stdout.write(str);
}

draw(1, 1, '██', 31); // 赤色で表示
draw(2, 1, '██', 34); // 青色で表示
draw(3, 2, '██', 32); // 緑色で表示
