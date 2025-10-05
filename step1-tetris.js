/**
 * 任意の位置に置いたブロックを移動させる
 */
export {};
// 1セルを塗りつぶす文字
const B = '██';

// ANSIカラーコードの定義（30:黒, 31:赤, 32:緑, 33:黄, 34:青, 35:マゼンタ, 36:シアン, 37:白）
const COLOR_OFFSET = 30; // 0は黒、1は赤、2は緑、3は黄、4は青、5はマゼンタ、6はシアン、7は白

const BLOCKS = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1], // 0: 黒（空白）, 1: 赤
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [2, 2], // 2:緑
    [2, 2],
  ],
  T: [
    [0, 3, 0], // 3:黄
    [3, 3, 3],
    [0, 0, 0],
  ],
  S: [
    [0, 4, 4], // 4:青
    [4, 4, 0],
    [0, 0, 0],
  ],
  Z: [
    [5, 5, 0], // 5:マゼンタ
    [0, 5, 5],
    [0, 0, 0],
  ],
  J: [
    [6, 0, 0],
    [6, 6, 6], // 6:シアン
    [0, 0, 0],
  ],
  L: [
    [0, 0, 7],
    [7, 7, 7], // 7:白
    [0, 0, 0],
  ],
};

// #region 画面描画関連
/**
 * 任意の位置に文字を描画する
 * @param {number} x
 * @param {number} y
 * @param {string} chars
 * @param {string} color
 */
function draw(x, y, chars, color = '30') {
  let str = `\x1b[H`;
  str += `\x1b[${color}m\x1b[${y};${x}H${chars}\x1b[0m`; // 座標(x,y)にcharを表示
  // 左上に移動してから描画するとちらつきが減る
  process.stdout.write(str);
}

/**
 * ブロックを描画する
 * @param {*} x
 * @param {*} y
 * @param {number[][]} b - ブロックの行列（各要素は色を表す数値、0は空白。1:赤, 2:緑, 3:黄, 4:青, ...）
 * @returns {void}
 */
function drawBlock(x, y, b, c = B) {
  b.forEach((row, dy) => {
    row.forEach((val, dx) => {
      if (val) {
        // valは1以上の色インデックス。COLOR_OFFSETでANSIカラーコードに変換
        draw(x + dx * 2, y + dy, c, COLOR_OFFSET + val);
      }
    });
  });
}
// #endregion

// #region ブロックを回転する共通関数
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
// #endregion

function randomBlock() {
  const keys = Object.keys(BLOCKS);
  const randKey = keys[Math.floor(Math.random() * keys.length)];
  return BLOCKS[randKey];
}

const width = 20;
const height = 20;

let x = 10;
let y = 2;
let b = randomBlock();
drawBlock(x, y, b);
// process.stdout.write('\x1b[2J'); // 画面クリア
// process.stdout.write('\x1b[?25l'); // カーソルを非表示
process.stdout.write('\x1b[H'); // カーソルを左上へ
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', (key) => {
  drawBlock(x, y, b, '  ');
  if (key === '\u0003') process.exit();
  if (key === '\u001b[D') x = Math.max(0, x - 1); // ←
  if (key === '\u001b[C') x = Math.min(width - 1, x + 1); // →
  if (key === '\u001b[B') y = Math.min(height - 1, y + 1); // ↓
  if (key === '\u001b[A') y = Math.max(0, y - 1); // ↑
  if (key.toLowerCase() === 'x') b = rotateRight(b); // xで右回転
  if (key.toLowerCase() === 'z') b = rotateLeft(b); // zで左回転
  if (key.toLowerCase() === 'c') b = randomBlock(); // cでブロック変更
  drawBlock(x, y, b);
});
