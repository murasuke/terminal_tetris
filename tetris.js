/**
 * ターミナルで動くテトリス
 */

const BOARD_WIDTH = 10; // 左右の壁を含む盤面の横セル数
const BOARD_HEIGHT = 20; // 上下の壁を含む盤面の縦セル数
const TICK_INTERVAL = 500; // ブロックが1段落下する間隔（ミリ秒）

const EMPTY = 0; // ブロックが存在しないセル
const WALL = 8; // 衝突判定に使用する外周の壁
const CELL = '██'; // ターミナル上でゲームの1セルを表す文字列
// ブロック値1～7をANSI文字色31～37へ変換する際の加算値
const COLOR_OFFSET = 30;

// 0は空白(黒)、1～7はブロックの有無と描画色を表す
// 0:黒、1:赤、2:緑、3:黄、4:青、5:マゼンタ、6:シアン、7:白
const BLOCKS = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [2, 2],
    [2, 2],
  ],
  T: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  S: [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ],
  Z: [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ],
  J: [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ],
};

let board = initializeBoard(); // 外周の壁と固定済みブロックを保持する盤面
let currentBlock; // 現在落下しているテトリミノの二次元配列
let x; // 現在のテトリミノ左上の横位置（セル単位）
let y; // 現在のテトリミノ左上の縦位置（セル単位）
let score = 0; // 消去した行数を加算する得点
let timer = null; // 自動落下を実行するsetIntervalのタイマーID
let running = true; // キー入力とタイマーによる状態更新を受け付けるか

/**
 * 壁で囲んだ盤面を作る
 * @returns {number[][]}
 */
function initializeBoard() {
  const board = Array.from({ length: BOARD_HEIGHT }, () =>
    new Array(BOARD_WIDTH).fill(EMPTY),
  );

  board[0].fill(WALL);
  board[BOARD_HEIGHT - 1].fill(WALL);

  for (let y = 1; y < BOARD_HEIGHT - 1; y++) {
    board[y][0] = WALL;
    board[y][BOARD_WIDTH - 1] = WALL;
  }

  return board;
}

/**
 * 任意の位置に、色を指定して文字を描画する
 * @param {number} x - 横位置（0始まり、ターミナルの列単位）
 * @param {number} y - 縦位置（0始まり、ターミナルの行単位）
 * @param {string} chars - 描画する文字列
 * @param {string|number} color - ANSIカラー番号
 * @returns {void}
 */
function draw(x, y, chars, color = 37) {
  const moveCursor = `\x1b[${y + 1};${x + 1}H`;
  const setColor = `\x1b[${color}m`;
  const resetStyle = '\x1b[0m';

  process.stdout.write(moveCursor + setColor + chars + resetStyle);
}

/**
 * 盤面またはブロックの値をANSIカラー番号へ変換する
 * @param {number} value - セル値（1～7はブロック、8は壁）
 * @returns {number} ANSI文字色の番号
 */
function getColor(value) {
  return value === WALL ? 37 : COLOR_OFFSET + value;
}

/**
 * 二次元配列を指定位置へ描画する
 * @param {number} x - ゲーム上の横位置（セル単位）
 * @param {number} y - ゲーム上の縦位置（セル単位）
 * @param {number[][]} blockMatrix - 描画する盤面またはテトリミノの二次元配列
 * @param {string} chars - 1セルの描画に使う文字列。空白を渡すと消去する
 * @returns {void}
 */
function drawBlock(x, y, blockMatrix, chars = CELL) {
  blockMatrix.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value !== EMPTY) {
        draw((x + dx) * 2, y + dy, chars, getColor(value));
      }
    });
  });
}

/**
 * 画面を消去し、カーソルを左上へ戻す
 * @returns {void}
 */
function resetScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * 正方行列を指定方向へ90度回転する
 * @param {number[][]} matrix - 回転するテトリミノの正方行列
 * @param {'right'|'left'} direction - rightは時計回り、leftは反時計回り
 * @returns {number[][]} 回転後の新しい行列
 */
function rotateMatrix(matrix, direction) {
  const size = matrix.length;
  const transposed = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => matrix[x][y]),
  );

  if (direction === 'right') {
    return transposed.map((row) => row.reverse());
  }

  return transposed.reverse();
}

/**
 * 行列を時計回りに回転する
 * @param {number[][]} matrix - 回転するテトリミノの正方行列
 * @returns {number[][]} 回転後の新しい行列
 */
function rotateRight(matrix) {
  return rotateMatrix(matrix, 'right');
}

/**
 * 行列を反時計回りに回転する
 * @param {number[][]} matrix - 回転するテトリミノの正方行列
 * @returns {number[][]} 回転後の新しい行列
 */
function rotateLeft(matrix) {
  return rotateMatrix(matrix, 'left');
}

/**
 * 指定位置のブロックが盤面、壁、固定済みブロックと衝突するか判定する
 * @param {number[][]} board - 固定済みブロックと外周の壁を持つ盤面
 * @param {number[][]} blockMatrix - 衝突を調べるテトリミノの二次元配列
 * @param {number} offsetX - テトリミノ左上の盤面上の横位置（セル単位）
 * @param {number} offsetY - テトリミノ左上の盤面上の縦位置（セル単位）
 * @returns {boolean} 衝突する場合はtrue
 */
function isCollision(board, blockMatrix, offsetX, offsetY) {
  for (let blockY = 0; blockY < blockMatrix.length; blockY++) {
    for (let blockX = 0; blockX < blockMatrix[blockY].length; blockX++) {
      if (blockMatrix[blockY][blockX] === EMPTY) {
        continue;
      }

      // ブロック内の相対座標を盤面全体の座標へ変換する
      const boardX = offsetX + blockX;
      const boardY = offsetY + blockY;

      if (board[boardY] === undefined || board[boardY][boardX] === undefined) {
        return true;
      }

      if (board[boardY][boardX] !== EMPTY) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 現在のブロックを指定量だけ移動する
 * @param {number} dx - 横方向の移動量。正数は右、負数は左
 * @param {number} dy - 縦方向の移動量。正数は下、負数は上
 * @returns {boolean} - 移動できた場合はtrue
 */
function tryMove(dx, dy) {
  const nextX = x + dx;
  const nextY = y + dy;

  if (isCollision(board, currentBlock, nextX, nextY)) {
    return false;
  }

  drawBlock(x, y, currentBlock, '  ');
  x = nextX;
  y = nextY;
  drawBlock(x, y, currentBlock);
  return true;
}

/**
 * 現在のブロックを指定方向へ回転する
 * @param {'right'|'left'} direction - rightは時計回り、leftは反時計回り
 * @returns {boolean} - 回転できた場合はtrue
 */
function tryRotate(direction) {
  const rotated = rotateMatrix(currentBlock, direction);

  if (isCollision(board, rotated, x, y)) {
    return false;
  }

  drawBlock(x, y, currentBlock, '  ');
  currentBlock = rotated;
  drawBlock(x, y, currentBlock);
  return true;
}

/**
 * ブロックを盤面へ固定する
 * @param {number[][]} board - 固定先となる盤面
 * @param {number[][]} blockMatrix - 固定するテトリミノの二次元配列
 * @param {number} offsetX - テトリミノ左上の盤面上の横位置（セル単位）
 * @param {number} offsetY - テトリミノ左上の盤面上の縦位置（セル単位）
 * @returns {void}
 */
function placeBlock(board, blockMatrix, offsetX, offsetY) {
  for (let blockY = 0; blockY < blockMatrix.length; blockY++) {
    for (let blockX = 0; blockX < blockMatrix[blockY].length; blockX++) {
      const value = blockMatrix[blockY][blockX];

      if (value !== EMPTY) {
        board[offsetY + blockY][offsetX + blockX] = value;
      }
    }
  }
}

/**
 * 左右の壁を持つ空行を作る
 * @returns {number[]}
 */
function createEmptyRow() {
  const row = new Array(BOARD_WIDTH).fill(EMPTY);
  row[0] = WALL;
  row[BOARD_WIDTH - 1] = WALL;
  return row;
}

/**
 * 揃った行を削除し、消した行数を返す
 * @param {number[][]} board - 行を検査して更新する盤面
 * @returns {number} 消去した行数
 */
function clearLines(board) {
  let linesCleared = 0;

  for (let y = board.length - 2; y >= 1; y--) {
    if (board[y].every((cell) => cell !== EMPTY)) {
      board.splice(y, 1);
      board.splice(1, 0, createEmptyRow());

      y++;
      linesCleared++;
    }
  }

  return linesCleared;
}

/**
 * ランダムにブロックを選ぶ
 * @returns {number[][]}
 */
function getRandomBlock() {
  const names = Object.keys(BLOCKS);
  const name = names[Math.floor(Math.random() * names.length)];
  return BLOCKS[name];
}

/**
 * 盤面上部の中央へ配置する新しいブロックを作る
 * @returns {{block: number[][], x: number, y: number}}
 */
function newBlock() {
  const block = getRandomBlock();
  // ブロックの左上位置を、左右の壁を含む盤面の中央に合わせる
  const x = Math.floor((BOARD_WIDTH - block[0].length) / 2);
  const y = 1;

  return { block, x, y };
}

/**
 * 得点を盤面の下へ表示する
 * @returns {void}
 */
function displayScore() {
  draw(0, BOARD_HEIGHT, `SCORE: ${score}`, 37);
}

/**
 * 盤面と得点を描き直す
 * @returns {void}
 */
function redrawBoard() {
  resetScreen();
  drawBlock(0, 0, board);
  displayScore();
}

/**
 * ターミナルをゲーム用の入力・表示状態へ切り替える
 * @returns {void}
 */
function setupTerminal() {
  if (!process.stdin.isTTY) {
    throw new Error('対話型ターミナル上で実行してください');
  }

  process.stdout.write('\x1b[?25l');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
}

/**
 * ターミナルの入力・表示状態を元へ戻す
 * @returns {void}
 */
function restoreTerminal() {
  if (process.stdin.isTTY && process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }

  process.stdin.pause();
  process.stdout.write('\x1b[?25h');
}

/**
 * 新しいブロックを生成して描画する
 * @returns {boolean} - 初期位置へ置けた場合はtrue
 */
function spawnNextBlock() {
  ({ block: currentBlock, x, y } = newBlock());

  if (isCollision(board, currentBlock, x, y)) {
    return false;
  }

  drawBlock(x, y, currentBlock);
  return true;
}

/**
 * 現在のブロックを固定し、行消去と次のブロック生成を行う
 * @returns {void}
 */
function lockCurrentBlock() {
  placeBlock(board, currentBlock, x, y);

  const linesCleared = clearLines(board);
  score += linesCleared;

  redrawBoard();

  if (!spawnNextBlock()) {
    finishGame('GAME OVER');
  }
}

/**
 * ゲームを終了し、ターミナルを元へ戻す
 * @param {string} message - 盤面中央へ表示する終了メッセージ。空文字なら表示しない
 * @returns {void}
 */
function finishGame(message = '') {
  if (!running) {
    return;
  }

  running = false;

  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }

  if (message !== '') {
    const terminalWidth = BOARD_WIDTH * 2; // 1セルを2文字で描くためターミナル幅へ変換
    const messageX = Math.max(
      0,
      Math.floor((terminalWidth - message.length) / 2),
    );
    const messageY = Math.floor(BOARD_HEIGHT / 2);

    draw(messageX, messageY, message, 31);
  }

  restoreTerminal();
  process.stdout.write(`\x1b[${BOARD_HEIGHT + 2};1H`);
}

/**
 * キー入力またはタイマーからゲームの状態を更新する
 * @param {string} key - 文字キーまたは矢印キーのエスケープシーケンス
 * @returns {void}
 */
function handleKeyPress(key) {
  if (!running) {
    return;
  }

  switch (key) {
    case '\u0003': // Ctrl+C
      finishGame();
      break;
    case '\u001b[D': // ←
      tryMove(-1, 0);
      break;
    case '\u001b[C': // →
      tryMove(1, 0);
      break;
    case '\u001b[B': // ↓
      if (!tryMove(0, 1)) {
        lockCurrentBlock();
      }
      break;
    case '\u001b[A': // ↑
    case 'x':
      tryRotate('right');
      break;
    case 'z':
      tryRotate('left');
      break;
  }
}

/**
 * ゲームを初期化して開始する
 * @returns {void}
 */
function main() {
  process.on('exit', restoreTerminal);
  setupTerminal();

  redrawBoard();

  if (!spawnNextBlock()) {
    finishGame('GAME OVER');
    return;
  }

  timer = setInterval(() => {
    handleKeyPress('\u001b[B');
  }, TICK_INTERVAL);

  process.stdin.on('data', handleKeyPress);
}

main();
