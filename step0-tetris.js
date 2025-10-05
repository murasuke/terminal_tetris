/**
 * 任意の位置に文字を描画するサンプル
 */
export {};
/**
 * 任意の位置に文字を描画する
 * @param {number} x
 * @param {number} y
 * @param {string} chars
 * @param {string} color
 */
function draw(x, y, chars, color = '30') {
  // 座標(x,y)にcharsを表示（カーソル移動＋色指定）
  let str = `\x1b[H\x1b[${color}m\x1b[${y + 1};${x + 1}H${chars}\x1b[0m`;
  // 左上に移動してから描画するとちらつきが減る
  process.stdout.write(str);
}

draw(5, 15, '██', 31); // 赤色で表示
draw(6, 6, '██', 34); // 青色で表示
draw(7, 10, '██', 32); // 緑色で表示

/**
 * 行列を回転させる
 * @param {number[][]} matrix
 * @param {"right" | "left"} dir
 * @returns {number[][]}
 */
function rotateMatrix(matrix, dir) {
  const n = matrix.length;
  // 転置
  const transposed = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => matrix[j][i])
  );

  if (dir === 'right') {
    // 時計回り → 転置後に各行を反転
    return transposed.map((row) => row.reverse());
  } else {
    // 反時計回り → 転置後に上下を反転
    return transposed.reverse();
  }
}
/**
 * 右に回転させる
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
function rotateRight(matrix) {
  return rotateMatrix(matrix, 'right');
}

/**
 * 左に回転させる
 * @param {number[][]} matrix
 * @returns {number[][]}
 */
function rotateLeft(matrix) {
  return rotateMatrix(matrix, 'left');
}

let B = '██';

// ANSIカラーコードの定義（30:黒, 31:赤, 32:緑, 33:黄, 34:青, 35:マゼンタ, 36:シアン, 37:白）
const COLOR_OFFSET = 30; // 0は黒、1は赤、2は緑、3は黄、4は青、5はマゼンタ、6はシアン、7は白

let L = [
  [0, 0, 1], // 0: 黒（空白）, 1: 赤
  [1, 1, 1],
  [0, 0, 0],
];

/**
 *
 * @param {*} x
 * @param {*} y
 * @param {number[][]} b - ブロックの行列（各要素は色を表す数値、0は空白。1:赤, 2:緑, 3:黄, 4:青, ...）
 * @returns {void}
 */
function drawBlock(x, y, b) {
  b.forEach((row, dy) => {
    row.forEach((val, dx) => {
      if (val) {
        // valは1以上の色インデックス。COLOR_OFFSETでANSIカラーコードに変換
        draw(x + dx * 2, y + dy, B, COLOR_OFFSET + val);
      }
    });
  });
}

drawBlock(10, 2, L);

drawBlock(20, 2, rotateLeft(L));
drawBlock(30, 5, rotateLeft(rotateLeft(L)));
drawBlock(40, 5, rotateLeft(rotateLeft(rotateLeft(L))));
