## 5. 盤面とテトリミノを配列で表す

ここまでで、ターミナルへの描画とキーボードからの入力ができるようになりました。次は、テトリスの盤面と落下ブロックをJavaScriptのデータとして表し、ゲームのルールを実装します。

ターミナルに表示されている文字を元に、セルが空いているかをプログラムから調べることはできません。そのため、ゲームの状態は二次元配列で管理し、ターミナルには配列の内容を描画する仕組みにします。この「状態」と「表示」を分ける考え方が、移動、衝突判定、行消去の土台になります。

### 5.1 二次元配列から盤面とブロックを描く

#### 盤面を二次元配列で表す

テトリスの盤面は、横方向に並ぶセルを一つの配列、その配列を縦方向に並べた二次元配列として表せます。

```js
const board = [
  [8, 8, 8, 8, 8, 8],
  [8, 0, 0, 0, 0, 8],
  [8, 0, 1, 1, 0, 8],
  [8, 0, 0, 1, 1, 8],
  [8, 8, 8, 8, 8, 8],
];
```

各数値の意味は次のとおりです。

| 値 | 意味 |
| --- | --- |
| `0` | 何もないセル |
| `1`～`7` | 固定されたブロック。数値は描画色にも対応する |
| `8` | 盤面を囲む壁 |

左右と上下を値 `8` の壁で囲んでおくと、ブロックが盤面の端へ到達した場合も、積まれたブロックに接触した場合も「移動先に0以外の値がある」として共通のロジックで判定できます。

完成版では、壁を含めて横10セル、縦20セルの盤面を作ります。

```js
const BOARD_WIDTH = 10; // 左右の壁を含む盤面の横セル数
const BOARD_HEIGHT = 20; // 上下の壁を含む盤面の縦セル数
const EMPTY = 0; // ブロックが存在しないセル
const WALL = 8; // 衝突判定に使用する外周の壁

function initializeBoard() {
  const board = Array.from({ length: BOARD_HEIGHT }, () =>
    new Array(BOARD_WIDTH).fill(EMPTY)
  );

  // 上下の壁
  board[0].fill(WALL);
  board[BOARD_HEIGHT - 1].fill(WALL);

  // 左右の壁
  for (let y = 1; y < BOARD_HEIGHT - 1; y++) {
    board[y][0] = WALL;
    board[y][BOARD_WIDTH - 1] = WALL;
  }

  return board;
}
```

`Array.from()`のコールバック内で行ごとに新しい配列を作るのがポイントです。次のように `fill()` へ同じ配列を渡すと、すべての行が一つの配列を共有してしまいます。

```js
// すべての行が同じ配列を参照するため、盤面の作成には使わない
const board = new Array(BOARD_HEIGHT).fill(
  new Array(BOARD_WIDTH).fill(EMPTY)
);
```


#### テトリミノ(落下ブロック)の形と色を表す

テトリミノも二次元配列で表します。`0`は空白、`0`以外の値はブロックを構成するセルです。値 `1`から`7`は、第3章で扱ったANSIカラー番号 `31`から`37`に対応させます。

```js
// 0は空白、1～7はブロックの有無と描画色を表す
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
```

回転処理を共通化するため、各テトリミノは `2×2`、`3×3`、`4×4`のいずれかの正方行列として定義しています。

#### 配列をターミナルへ描画する

二次元配列を二重ループで読み、`0`以外のセルだけを第3章の `draw()` へ渡します。値 `8` の壁は白色、それ以外は値に `30` を足した文字色で描画します。

```js
const CELL = '██'; // ターミナル上でゲームの1セルを表す文字列
// ブロック値1～7をANSI文字色31～37へ変換する際の加算値
const COLOR_OFFSET = 30;

function getColor(value) {
  return value === WALL ? 37 : COLOR_OFFSET + value;
}

function drawBlock(x, y, blockMatrix, chars = CELL) {
  blockMatrix.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value !== EMPTY) {
        draw(
          (x + dx) * 2,
          y + dy,
          chars,
          getColor(value)
        );
      }
    });
  });
}
```

引数の `x`、`y` はゲーム上のセル単位です。横方向は一つのセルを `██` の二文字で描くため、`draw()`へ渡す直前に `2`を掛けます。

盤面全体を描くときは、盤面の左上を `(0, 0)` として呼び出します。

```js
const board = initializeBoard();
drawBlock(0, 0, board);
```

落下中のテトリミノは盤面の配列へすぐには書き込まず、形を表す配列と位置を別々に持ちます。

```js
let currentBlock = BLOCKS.L;
let x = 3;
let y = 1;

drawBlock(x, y, currentBlock);
```

固定済みのセルは `board`、操作中のテトリミノは `currentBlock`、`x`、`y`に分けて管理します。これにより、操作中のブロックだけを独立して移動・回転させることができます。

### 5.2 ブロックを移動・回転する

#### 座標を変えて移動する

ブロックの移動は、形を表す配列を変更せず、盤面上の位置 `x`、`y`を増減するだけです。

| 移動方向 | 座標の変化 |
| --- | --- |
| 左 | `x - 1` |
| 右 | `x + 1` |
| 下 | `y + 1` |

画面上で移動しているように見せるには、移動前の位置を空白で消し、座標を更新してから新しい位置へ描画します。

```js
drawBlock(x, y, currentBlock, '  ');
x += 1;
drawBlock(x, y, currentBlock);
```

ただし、このままでは壁や積まれたブロックを通り抜けてしまいます。実際には、座標を変更する前に「移動先の位置へ配置できるか」を判定します。この処理は5.3節で追加します。

#### 行列を回転する

テトリミノの回転は、形を表す正方行列を回転する操作です。時計回りに90度回転する場合は、次の二段階で変換できます。

1. 行列の行と列を入れ替えて転置する
2. 転置した行列の各行を左右反転する

たとえば、L字形の行列を時計回りに回転すると、次のようになります。

```text
回転前       転置         各行を反転
0 0 7        0 7 0        0 7 0
7 7 7   →    0 7 0   →    0 7 0
0 0 0        7 7 0        0 7 7
```

JavaScriptでは、次のように実装できます。

```js
function rotateMatrix(matrix, direction) {
  const size = matrix.length;

  const transposed = Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => matrix[x][y])
  );

  if (direction === 'right') {
    return transposed.map((row) => row.reverse());
  }

  return transposed.reverse();
}

function rotateRight(matrix) {
  return rotateMatrix(matrix, 'right');
}

function rotateLeft(matrix) {
  return rotateMatrix(matrix, 'left');
}
```

転置した後、各行を反転すると時計回り、行の上下を反転すると反時計回りになります。元の行列から新しい行列を作って返すため、回転できるかを判定する前に現在の形が失われることもありません。

```js
const rotated = rotateRight(currentBlock);

// rotatedを配置できる場合だけcurrentBlockを更新する
currentBlock = rotated;
```

壁際で回転した結果が盤面と重なる場合は回転を取り消します。市販のテトリスにある、ブロックを横へずらして回転させる動作は実装しません。

### 5.3 壁や積まれたブロックとの衝突を判定する

移動や回転の前に、変更後のブロックが盤面と重ならないことを確認します。判定に必要なのは、次の二つの座標です。

- ブロック内の座標：`blockX`、`blockY`
- 盤面上でのブロック左上の位置：`offsetX`、`offsetY`

両方を足すと、ブロックの各セルが盤面のどのセルと重なるかを求められます。

```text
boardX = offsetX + blockX
boardY = offsetY + blockY
```

ブロックの `0` のセルは空白なので無視します。`0`以外のセルについて、盤面外へ出ているか、盤面側にすでに値がある場合は衝突とみなします。

```js
function isCollision(board, blockMatrix, offsetX, offsetY) {
  for (let blockY = 0; blockY < blockMatrix.length; blockY++) {
    for (let blockX = 0; blockX < blockMatrix[blockY].length; blockX++) {
      if (blockMatrix[blockY][blockX] === EMPTY) {
        continue;
      }

      const boardX = offsetX + blockX;
      const boardY = offsetY + blockY;

      if (
        board[boardY] === undefined ||
        board[boardY][boardX] === undefined
      ) {
        return true;
      }

      if (board[boardY][boardX] !== EMPTY) {
        return true;
      }
    }
  }

  return false;
}
```

盤面の外周には値 `8` の壁があり、固定済みブロックには値 `1`から`7`が入っています。どちらも `0`以外なので、1つの条件で判定できます。配列の範囲外も衝突として扱うことで、予期しない座標が渡された場合にも盤面から飛び出しません。

この関数を使うと、移動処理は次のように書けます。

```js
function tryMove(dx, dy) {
  const nextX = x + dx;
  const nextY = y + dy;

  // 移動可能か？
  if (isCollision(board, currentBlock, nextX, nextY)) {
    return false;
  }

  // 現在位置をスペースでクリアしてから、次の位置にブロックを描画する
  drawBlock(x, y, currentBlock, '  ');
  x = nextX;
  y = nextY;
  drawBlock(x, y, currentBlock);
  return true;
}
```

左移動は `tryMove(-1, 0)`、右移動は `tryMove(1, 0)`、下移動は `tryMove(0, 1)` と呼び出します。先に候補座標で衝突を調べ、問題がない場合だけ現在位置を更新するのがポイントです。

回転も同じように、回転後の配列を候補として先に作り、衝突しない場合だけ採用します。

```js
function tryRotate(direction) {
  const rotated = rotateMatrix(currentBlock, direction);

  // 回転後のブロックが衝突しないか？
  if (isCollision(board, rotated, x, y)) {
    return false;
  }

  drawBlock(x, y, currentBlock, '  ');
  currentBlock = rotated;
  drawBlock(x, y, currentBlock);
  return true;
}
```

ブロックを下へ動かせなくなったら、操作中のブロックを盤面へ固定します。`0`以外のセルを、対応する盤面の位置へ書き込みます。

```js
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
```

固定後は盤面側に値が残るため、次に落ちてくるブロックはその値との衝突を判定できるようになります。

### 5.4 揃った行を消して上の行を詰める

ブロックを固定した後は、横一行が揃い消去可能かどうかを確認します。外周の壁も `0`以外なので、行内のすべてのセルが `0`以外であれば、その行の内側はすべてブロックで埋まっています。

ただし、一番上と一番下の行は壁なので判定対象から外します。下から上へ向かって、`board.length - 2`から`1`までを調べます。

```js
function createEmptyRow() {
  const row = new Array(BOARD_WIDTH).fill(EMPTY);
  row[0] = WALL;
  row[BOARD_WIDTH - 1] = WALL;
  return row;
}

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
```

揃った行を `splice()` で削除し、上側の壁の直下に新しい空行を挿入します。これにより、上にあった行が一段ずつ下へ移動し、盤面の高さも保持されます。

下から調べるのは、行を削除したときの添字の変化を扱いやすくするためです。


```text
消去前             1行を消去         空行を上へ追加
│      │          │      │          │      │  ← 新しく追加した空行
│  ██  │          │  ██  │          │      │
│██████│    →     │██████│    →     │  ██  │
│██████│ ←splice  │  底  │          │██████│
│  底  │                            │  底  │
```

行を削除して空行を上へ追加すると、直前まで1つ上にあった行が同じ添字 `y`へ移動してきます。連続した行を消せるように `y++` でループの減算を打ち消し、同じ添字をもう一度調べます。

戻り値の `linesCleared` は、得点の加算に利用できます。

```js
const cleared = clearLines(board);
score += cleared;
```

これで、盤面とテトリミノの表現、移動、回転、衝突、固定、行消去に必要な処理が揃いました。次章ではキー入力とタイマーを同じ更新処理へ集め、これらの関数を1つのゲームループとしてつなぎます。
