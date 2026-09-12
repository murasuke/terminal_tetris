# ターミナルで動くテトリスを作ろう

## 1. テトリスの実装を通して学ぶこと

### この記事の対象読者

この記事は、普段ターミナルでコマンドを実行していても、文字の色や表示位置をプログラムから制御したことがない人を対象としています。JavaScriptについては、変数、配列、関数、条件分岐、ループに関する基本的な知識があれば読み進められます。

### ターミナルをリッチな画面として使う

ターミナルは、コマンドの結果を下方向へ表示する、白黒だけの画面ではありません。制御用の文字列を送ることで、次のような操作ができます。

- カーソルを移動し、任意の位置に文字を表示する
- 文字に色を付ける
- 表示済みの文字を消したり、画面全体をクリアしたりする
- Enterを待たずにキー入力を受け取る

これらを組み合わせると、ターミナルを一枚の書き換え可能な画面として扱うことができます。本記事では、テトリスを題材に、ターミナルを制御する方法を学びます。

テトリスは格子状の盤面とブロックで構成されるため、文字による描画と相性がよく、複雑なグラフィックス機能を必要としません。ゲームとしての実装を通して、ターミナルの装飾機能と、テトリスのロジックを一通り確認することができます。

- 文字出力と色指定
- キー入力による移動と回転
- タイマーによる自動落下
- 配列を使った盤面の状態管理
- 壁やブロックとの衝突判定
- 行消去とゲームオーバー判定

### 完成形と実行環境

完成すると、色の付いたブロックが一定間隔で落下し、矢印キーなどで移動・回転できるテトリスが動きます。プログラムを単純にするため、経過時間によって落下速度が速くなる、といった機能はありません。

![ターミナルで動くテトリス](./image.png)

本記事で使用した環境は次のとおりです。

| ソフトウェア | バージョン |
| --- | --- |
| Windows Terminal | 1.24.11911.0 |
| Git Bash | GNU bash 5.2.26(1)-release（x86_64-pc-msys） |
| Node.js | v24.18.0 |

実行可能な完成版と、本文で省略した定数・補助関数は[GitHubの`tetris.js`](https://github.com/murasuke/terminal_tetris/blob/master/tetris.js)で確認できます。ダウンロード後、次のコマンドで起動します。

```bash
node tetris.js
```

本文では仕組みを理解するために重要な部分だけを掲載し、細かな実装は完成版へ委ねます。

## 2. テトリスの処理をターミナルとJavaScriptに分けて考える

実装を始める前に、ターミナルとJavaScriptの役割を分けて考えます。

| 担当 | 役割 |
| --- | --- |
| ターミナル | 指定された位置への文字・色の描画と、キーボード入力の受け渡し |
| JavaScript | 盤面の状態管理と、移動・回転・衝突・行消去などのゲームルール |

ターミナルはゲームの「画面」、キーボードは「コントローラー」、JavaScriptはゲームの「状態とルール」を担当する、と考えると分かりやすいでしょう。
ゲーム中は、次の流れを繰り返します。

```text
キー入力 ─────┐
                ├─→ 移動・回転後の候補を作る ─→ 衝突判定 ─→ 状態を更新 ─→ 描画
タイマー ─────┘
```

重要なのは、ターミナルに表示された文字をゲームの状態として使わないことです。盤面やブロックの位置はJavaScriptが保持し、移動可能かを配列上で判定してから、その結果だけをターミナルへ描画します。

以降の節では、この流れを機能ごとに組み立てます。

- 第3節：文字列で画面を操る――エスケープシーケンス
- 第4節：Enterを待たずにキー入力を受け取る――Rawモード
- 第5節：盤面とテトリミノを配列で表す
- 第6節：描画・入力・時間をゲームループにつなぐ

## 3. 文字列で画面を操る――エスケープシーケンス

テトリスでは、ブロックの位置に合わせて画面の一部を書き換えます。Node.jsから制御用の文字列を出力することで、表示位置や色を指定することができます。

### 3.1 標準出力の文字列をターミナルが解釈する

| 要素 | 役割 |
| --- | --- |
| ターミナルエミュレーター | 文字を描画し、色やカーソル位置を制御する |
| Node.jsプログラム | ゲームの状態を計算し、表示内容を標準出力へ書き込む |

Node.jsが`process.stdout.write()`で書き込んだデータは、ターミナルエミュレーターへ渡されます。通常の文字はそのまま表示されますが、制御文字`ESC`から始まる**エスケープシーケンス**は画面制御命令として解釈されます。
描画時に自動で改行されないよう、`console.log()`ではなく`process.stdout.write()`を使います。

```js
process.stdout.write('Hello');
process.stdout.write('\x1b[31mHello\x1b[0m');
```

一つ目は現在のカーソル位置へ`Hello`を表示します。二つ目では、`\x1b[31m`が赤色を指定する命令として処理されるため、制御文字列そのものは画面に表示されません。

```text
Node.js ──→ 標準出力 ──→ ターミナルエミュレーター ──→ 画面
```

多くの命令は、`ESC [`にパラメーターと命令文字を続ける形になっています。`ESC [`を **CSI（Control Sequence Introducer）** と呼び、JavaScriptでは`\x1b[`と記述します。

### 3.2 座標と色を指定して描く

カーソル移動と色指定に使用する主なエスケープシーケンスは次のとおりです。

| 操作 | シーケンス |
| --- | --- |
| カーソルを指定位置へ移動 | `ESC [ 行 ; 列 H` |
| 文字色を指定 | `ESC [ 色番号 m` |
| 色などの表示属性をリセット | `ESC [ 0 m` |

ターミナルの座標は左上が`(1, 1)`で、縦の行、横の列の順に指定します。一方、ゲーム内では0始まりの`(x, y)`を使うため、出力時にそれぞれ1を加え、`y`、`x`の順に並べます。

| 位置 | ゲーム内の座標 `(x, y)` | ターミナルの指定 `(行, 列)` |
| --- | --- | --- |
| 左上 | `(0, 0)` | `(1, 1)` |
| 右へ4、下へ2 | `(4, 2)` | `(3, 5)` |

基本的な文字色は次のとおりです。

| 番号 | 色 |
| --- | --- |
| `30` | 黒 |
| `31` | 赤 |
| `32` | 緑 |
| `33` | 黄 |
| `34` | 青 |
| `35` | マゼンタ |
| `36` | シアン |
|`37` | 白 |

上記エスケープシーケンスを組み合わせると、指定した座標、文字列、色で出力する処理`draw()`を作ることができます。

```js
function draw(x, y, chars, color = 37) {
  const moveCursor = `\x1b[${y + 1};${x + 1}H`;
  const setColor = `\x1b[${color}m`;
  const resetStyle = '\x1b[0m';

  process.stdout.write(moveCursor + setColor + chars + resetStyle);
}
```

色をリセットしないと、その後のゲーム画面やシェルのプロンプトにも同じ色が引き継がれます。そのため、描画する文字の直後に必ず`\x1b[0m`を出力します。

このコードでは、色コードをそのままわたしていますが、完成版では、盤面の値（`1`から`7`）を`getColor()`で色番号へ変換してから、`draw()`へ渡します。盤面を表す二次元配列の値で「セルが埋まっていること(`0`以外)」と「描画色(`+30`)」の両方を表しています。

### 3.3 ゲームの1セルを`██`で表す

ターミナルの描画単位はピクセルではなく文字です。一般的に一文字分の領域は縦長なので、本記事では`█`（FULL BLOCK）を横に二つ並べた`██`を、ゲーム上の1セルとして扱います。画面上では、`██`の2文字で一つの正方形のブロックを表します。

たとえば`draw(4, 2, '██', 31)`と呼び出すと、ゲーム内の`(4, 2)`に相当する位置へ、赤い1セルを表示できます。座標変換を関数内へ集めることで、ゲームロジックはターミナルが1始まりであることを意識せずに済みます。

ゲーム上で横座標が1増えると、ターミナル上では2列進みます。そのため、盤面を描画する際は横座標に2を掛けて`draw()`へ渡します。この二次元配列からの描画処理は第5節で実装します。

文字の表示幅や縦横比は、フォントやターミナルの設定によって異なります。本書ではフォントの都合上、██が横長に見えますが、等幅フォントを使用したターミナルでは、2文字で正方形に近い形になります。盤面がずれて見える場合は、等幅フォントを使用してください。

### 3.4 描いたものを消す

ターミナル上の文字を削除する代わりに、同じ位置へ同じ幅の空白を描いて上書きします。前節のとおり、ゲーム上の1セルは2文字分なので、消去にも空白2文字を使います。

```js
draw(4, 2, '██', 31); // 1セルを描画
draw(4, 2, '  ');     // 1セルを消去
```

ブロックを移動するときは、まず現在位置を空白で上書きして消します。次に座標を更新し、新しい位置へ描く、という順番で処理します。盤面全体を毎回描き直さず、変化した部分だけを更新することで、ちらつきを抑えることができます。

行消去などで盤面全体を描き直す場合は、画面を消去する`\x1b[2J`と、カーソルを左上へ戻す`\x1b[H`を続けて出力します。

```js
function resetScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}
```

普段のブロック移動では空白による部分消去を使い、行消去のように広い範囲が変化するときだけ全体を描き直します。

## 4. Enterを待たずにキー入力を受け取る――Rawモード

通常のターミナル入力はEnterキーが押されるまでプログラムへ渡されません。テトリスではキーを押した瞬間にブロックを動かす必要があるため、Rawモードへ切り替えます。

### 4.1 キー入力がプログラムへ届くまで

キー入力は、概念的には次の経路を通ります。

```text
キーボード
    ↓
ターミナルエミュレーター
    ↓ 文字やエスケープシーケンス
カーネルのラインディシプリン
    ↓ 標準入力
Node.jsプログラム
```

ラインディシプリンは、入力のバッファリング、入力文字のエコー、`Ctrl+C`のシグナルへの変換などを担当します。その動作は入力モードによって変わります。

通常のカノニカルモードでは、入力した文字がラインディシプリンに蓄えられ、Enterを押した時点で一行分が標準入力へ渡されます。キーを押すたびに入力文字が画面に表示されるのは、`ECHO`機能が文字を出力側へ返しているためです。

| 項目 | カノニカルモード | Rawモード |
| --- | --- | --- |
| プログラムへ渡す単位 | Enterまでの一行 | Enterを待たずに受け取る<br>（複数の入力がまとまる場合もある） |
| 入力文字の自動表示 | あり | なし |
| 行編集 | ラインディシプリンなどが処理 | プログラム側で処理 |
| `Ctrl+C` | 通常は終了シグナル | 文字コードとして届く |

Rawモードは、Enter待ちだけでなく、エコーや制御文字の特別扱いも無効にし、全てのキー入力をプログラム側で処理するための設定です。

シェル上で利用できる左右キーによるカーソル移動などは、Bashが使用するReadlineのような行編集機能が受け持っています。RawモードのNode.jsプログラムでは、それらの操作も必要に応じて自分で処理します。

### 4.2 Rawモードへの切り替えと復元

ゲーム開始時と終了時の処理を、それぞれ関数へまとめます。

```js
function setupTerminal() {
  if (!process.stdin.isTTY) {
    throw new Error('対話型ターミナル上で実行してください');
  }

  process.stdout.write('\x1b[?25l'); // カーソルを隠す
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
}

function restoreTerminal() {
  if (process.stdin.isTTY && process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }

  process.stdin.pause();
  process.stdout.write('\x1b[?25h'); // カーソルを表示する
}
```

各設定の役割は次のとおりです。

| 処理 | 役割 |
| --- | --- |
| `process.stdin.isTTY` | 対話型ターミナルへ接続されているか確認する |
| `setRawMode(true)` | Rawモードへ切り替える |
| `resume()` | 標準入力の読み取りを開始する |
| `setEncoding('utf8')` | 入力を文字列として受け取る |

`setEncoding('utf8')`により、入力を`Buffer`ではなく文字列として受け取れます。

`restoreTerminal()`を呼び出さずに終了すると、カーソルが表示されないといった問題が発生するため、必ず呼び出すようにします。`Ctrl+C`は`\u0003`として届くので、その場合は`restoreTerminal()`を呼び出します。また、通常終了時にも復元されるよう、`process.on('exit', restoreTerminal)`を登録します。

```js
process.on('exit', restoreTerminal);

process.stdin.on('data', (key) => {
  if (key === '\u0003') {
    restoreTerminal();
  }
});
```

ターミナルのモードやカーソル表示はプログラム終了後にも残るため、復元処理は単なる見た目の調整ではなく、対話型プログラムに必要な後始末です。

### 4.3 矢印キーもエスケープシーケンス

文字キーは`a`や`x`として届きますが、矢印キーは`ESC`から始まる複数文字のシーケンスとして届きます。

| キー | 受け取る値 |
| --- | --- |
| ↑ | `\u001b[A` |
| ↓ | `\u001b[B` |
| → | `\u001b[C` |
| ← | `\u001b[D` |

完成版では、キーを次の操作へ割り当てます。

| キー | 操作 |
| --- | --- |
| ←・→ | 左右へ1セル移動 |
| ↓ | 下へ1セル移動 |
| ↑または`x` | 時計回りに回転 |
| `z` | 反時計回りに回転 |
| `Ctrl+C` | ゲームを終了 |

`\u001b`と第3節の`\x1b`は、どちらも文字コード`0x1b`の`ESC`を表します。特殊キーのデータは、出力時と同様の形式のシーケンスとして受け取ります。

`data`イベントで受け取った値を第6節の`handleKeyPress()`へ渡し、移動や回転へ変換します。なお、一度の`data`イベントに複数の入力がまとまる場合もありますが、今回の最小実装では文字列の完全一致で判定します。

### 4.4 復元できなくなった場合

開発中のエラーなどで入力やカーソル表示が元に戻らなかった場合は、Git Bashで次のコマンドを入力するか、貼り付けてください。入力文字が見えなくても、そのまま入力してEnterキーを押してください。

```bash
stty sane
printf '\033[?25h'
```

## 5. 盤面とテトリミノを配列で表す

ターミナルに表示した文字から、セルが空いているかどうかをプログラムから調べることはできません。そのため、ゲームの状態はJavaScriptの二次元配列で管理し、その内容をターミナルへ描画する必要があります。

### 5.1 盤面とテトリミノ（落ちてくるブロック）を二次元配列で表す

盤面は、横方向のセルを一つの配列とし、それを縦方向に並べて表します。

```js
const board = [
  [8, 8, 8, 8, 8, 8],
  [8, 0, 0, 0, 0, 8],
  [8, 0, 1, 1, 0, 8],
  [8, 0, 0, 1, 1, 8],
  [8, 8, 8, 8, 8, 8],
];
```

| 値 | 意味 |
| --- | --- |
| `0` | 空のセル |
| `1`～`7` | 固定済みブロック。値は描画色にも対応する |
| `8` | 盤面を囲む壁 |

外周を値`8`の壁で囲むことで、衝突判定を簡素化できます。盤面の外周と固定済みブロックを個別に区別せず、「移動先が`0`以外なら衝突」と判定できます。

```js
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const EMPTY = 0;
const WALL = 8;

function initializeBoard() {
  const board = Array.from({ length: BOARD_HEIGHT }, () =>
    new Array(BOARD_WIDTH).fill(EMPTY)
  );

  board[0].fill(WALL);
  board[BOARD_HEIGHT - 1].fill(WALL);

  for (let y = 1; y < BOARD_HEIGHT - 1; y++) {
    board[y][0] = WALL;
    board[y][BOARD_WIDTH - 1] = WALL;
  }

  return board;
}
```

二次元の配列を作成するため`Array.from()`のコールバック内で、行ごとに新しい配列を作ります。次に外周に`8`をセットして壁を作ります。

テトリミノも、`0`を空白、`0`以外をブロックとする正方行列で表します。値`1`から`7`はANSI文字色`31`から`37`に対応させます。

```js
const BLOCKS = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  T: [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ],
  // O、S、Z、J、Lも同様に定義する
};
```

残りの定義は完成版の`tetris.js`に掲載しています。
同じ関数で回転操作ができるように、全て正方行列にします。

ブロックの値を種類ごとに変えることで、盤面へ固定した後も元の色を保持できます。形と色を一つの配列でまとめて扱えます。

#### 配列を描画する

二次元配列の、`0`以外のセルを第3節の`draw()`へ渡します。横方向は1セルを`██`の2文字で表すため、座標に2を掛けます。（`x`、`y`）はオフセットです。

```js
const CELL = '██';
const COLOR_OFFSET = 30;

function getColor(value) {
  return value === WALL ? 37 : COLOR_OFFSET + value;
}

function drawBlock(x, y, blockMatrix, chars = CELL) {
  blockMatrix.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value !== EMPTY) {
        draw((x + dx) * 2, y + dy, chars, getColor(value));
      }
    });
  });
}
```

固定済みセルは`board`に保持し、操作中のテトリミノは`currentBlock`と座標（現在位置）`x`、`y`を別に管理します。操作中のブロックだけを移動・回転できます。

```js
const board = initializeBoard();
let currentBlock = BLOCKS.T;
let x = 3;
let y = 1;

drawBlock(0, 0, board);
drawBlock(x, y, currentBlock);
```

落下中のブロックは、固定されるまで`board`へ書き込みません。盤面と操作中のブロックを分け、別々に描画することで、移動前の表示を消しても固定済みセルの状態は失われません。

### 5.2 ブロックを移動・回転する

移動では、テトリミノの形を変えずに座標だけを増減します。

| 方向 | 座標の変化 |
| --- | --- |
| 左 | `x - 1` |
| 右 | `x + 1` |
| 下 | `y + 1` |

画面では、現在位置を空白で消し、座標を更新してから新しい位置へ描画します。ただし、座標を更新するのは、次節の衝突判定で移動可能と確認した後です。

```js
drawBlock(x, y, currentBlock, '  '); //現在位置のブロックを消す
x += 1; // 右移動
drawBlock(x, y, currentBlock);  // 移動先で描画
```

テトリミノを時計回りに90度回転するには、正方行列を転置し、各行を左右反転します。反時計回りの場合は、転置後に行の上下を反転します。

```text
回転前       転置         各行を反転
0 0 7        0 7 0        0 7 0
7 7 7   ->   0 7 0   ->   0 7 0
0 0 0        7 7 0        0 7 7
```

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
```

新しい行列を返すため、回転後に衝突した場合でも、`currentBlock`を上書きしなければ、現在の形は失われません。

```js
const rotated = rotateMatrix(currentBlock, 'right');

if (!isCollision(board, rotated, x, y)) {
  currentBlock = rotated;
}
```

### 5.3 壁や固定済みブロックとの衝突を判定する

衝突判定に必要なのは、次の二つの座標です。

- ブロック内の座標：`blockX`、`blockY`
- 盤面上でのブロック左上の位置：`offsetX`、`offsetY`

両方を足すと、ブロックの各セルが盤面のどのセルと重なるかを求められます。

```text
boardX = offsetX + blockX
boardY = offsetY + blockY
```

ブロック側が`0`のセルは無視し、`0`以外のセルについて、盤面外へ出ている場合、または盤面側にすでに値がある場合は衝突とみなします。

外周の壁も固定済みブロックも`0`以外なので、別々の条件を用意する必要はありません。配列の範囲外も衝突として扱い、予期しない座標が渡された場合に盤面から飛び出すことを防ぎます。

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
        board[boardY][boardX] === undefined ||
        board[boardY][boardX] !== EMPTY
      ) {
        return true;
      }
    }
  }

  return false;
}
```

移動処理は次のように書けます。

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

左移動は`tryMove(-1, 0)`、右移動は`tryMove(1, 0)`、下移動は`tryMove(0, 1)`として呼び出します。先に移動先座標で衝突チェックを行い、問題がない場合だけ表示と状態を変更するのがポイントです。

回転も同じように、回転後の配列を候補として先に作り、衝突しない場合だけ採用します。壁際で回転したことで衝突する場合は回転を取り消します。

```js
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
```

ブロックを下へ動かせなくなったら、操作中のブロックを盤面へ固定します。`0`以外のセルを、対応する盤面の位置へ書き込んで固定します。

```js
function placeBlock(board, blockMatrix, offsetX, offsetY) {
  blockMatrix.forEach((row, blockY) => {
    row.forEach((value, blockX) => {
      if (value !== EMPTY) {
        board[offsetY + blockY][offsetX + blockX] = value;
      }
    });
  });
}
```

固定後は盤面側に値が残るため、次に落ちてくるブロックはその値との衝突を判定できるようになります。

### 5.4 揃った行を消す

ブロックを固定した後は、横一行がすべて埋まっているかを確認します。すべてのセルが`0`以外ならその行を削除し、削除行より上をずらします。

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

```text
消去前             行を削除          空行を上へ追加
│　　　│          │　　　│          │　　　│  ← 空行
│　█　│          │　█　│          │　　　│
│███│    →    │███│    →     │　█　│
│███│ ←削除    │　底　│          │███│
│　底　│                            │　底　│
```

`splice()`で削除したら、上側の壁の直下に新しい空行を挿入します。これにより、上にあった行が一段ずつ下へ移動し、盤面の高さも保持されます。

削除後は一つ上の行が同じ添字`y`へ移動するため、`y++`でループの減算を打ち消して同じ位置をもう一度調べます。戻り値の`linesCleared`は得点計算に使います。

## 6. 描画・入力・時間をゲームループにつなぐ

これまでの節で、テトリスに必要な部品を個別に作りました。

- ターミナルの任意の位置へ色付きの文字を描く
- Rawモードでキー入力を即座に受け取る
- 盤面とテトリミノを二次元配列で表す
- ブロックの移動、回転、衝突、固定、行消去を処理する

最後に、これらの部品を一つのゲームにまとめ上げます。テトリスの状態が変わるきっかけは、プレイヤーのキー入力と、タイマーによって発生する自動落下です。

### 6.1 キー入力とタイマーを同じ更新処理へ集める

今回のゲームでは`while (true)`を回すのではなく、Node.jsのイベントを利用します。キーが押されると標準入力の`data`イベントが発生し、一定時間が経過すると`setInterval()`のコールバックが呼び出されます。

```text
キー入力 ─────┐
                ├─→  移動・回転後の候補を作成 → 衝突判定 → 状態更新 → 描画
タイマー ─────┘
```

固定済みブロックは`board`、落下中のブロックは`currentBlock`と座標`x`、`y`で管理します。`score`には消した行数を加算し、`timer`には自動落下用タイマーを保持します。

| 状態 | 内容 |
| --- | --- |
| `board` | 外周の壁と固定済みブロック |
| `currentBlock`、`x`、`y` | 落下中のブロックと位置 |
| `score` | 消去した行数 |
| `timer` | 自動落下用タイマーのID |
| `running` | 状態更新を受け付けるか |

新しいブロックは、7種類の定義からランダムに選び、盤面の上部中央へ配置します。

```js
function newBlock() {
  const block = getRandomBlock();
  const x = Math.floor((BOARD_WIDTH - block[0].length) / 2);
  const y = 1;

  return { block, x, y };
}
```

固定済み盤面を描き直す場合は、画面を消去してから盤面と得点を出力します。落下中のブロックは`board`に含まれないため、別に描画します。

```js
function redrawBoard() {
  resetScreen();
  drawBlock(0, 0, board);
  draw(0, BOARD_HEIGHT, `SCORE: ${score}`, 37);
}
```

キー入力とタイマーのどちらも、同じ`handleKeyPress()`へ値を渡します。

```js
process.stdin.on('data', handleKeyPress);

timer = setInterval(() => {
  handleKeyPress('\u001b[B'); // 下キーと同じ入力
}, TICK_INTERVAL);
```

タイマーでは、下キーと同じ文字列を`handleKeyPress()`へ渡すことで、自動落下を実現できます。

### 6.2 移動、固定、行消去を処理する

キー入力を受け取ったら、第5節の`tryMove()`と`tryRotate()`を使って状態を更新します。
左右移動と回転は、移動先に衝突した場合は何もせず、現在の状態を維持します。下へ移動できない場合は、現在のブロックを盤面へ固定します。

```js
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
```

ブロックが下へ移動できなくなってから、次のブロックを操作するまでの流れは次のとおりです。

1. 現在のブロックを盤面へ固定する
2. 揃った行を消し、得点を加算する
3. 固定後の盤面を描き直す
4. 新しいブロックを生成する
5. 初期位置で衝突した場合は、ゲームオーバーにする

```js
function lockCurrentBlock() {
  // 1. 落下中のブロックを盤面へ固定する
  placeBlock(board, currentBlock, x, y);
  // 2. 揃った行を消して得点へ加算する
  const linesCleared = clearLines(board);
  score += linesCleared;
  // 3. 固定後の盤面と得点を描き直す
  redrawBoard();
  // 4,5. 次のブロックの生成と、衝突チェック
  if (!spawnNextBlock()) {
    finishGame('GAME OVER');
  }
}
```

`spawnNextBlock()`は、新しいブロックと初期座標で`isCollision()`を呼び出します。衝突しなければ描画して`true`、衝突すれば`false`を返します。

```js
function spawnNextBlock() {
  ({ block: currentBlock, x, y } = newBlock());

  if (isCollision(board, currentBlock, x, y)) {
    return false;
  }

  drawBlock(x, y, currentBlock);
  return true;
}
```
新しく生成したブロックが初期位置で盤面と衝突する場合は、どこにも動かせないのでゲームオーバーです。

### 6.3 ゲームを開始・終了する

最後に、初期化からイベント登録までを`main()`へまとめます。

```js
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
```

ゲームオーバーまたは`Ctrl+C`で終了するときは、タイマーを止め、Rawモードとカーソル表示を元へ戻します。二重に終了処理が走っても問題が起きないよう、`running`で状態を確認します。


```js
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
      Math.floor((terminalWidth - message.length) / 2)
    );
    const messageY = Math.floor(BOARD_HEIGHT / 2);

    draw(messageX, messageY, message, 31);
  }

  restoreTerminal();

  // 次のシェルプロンプトがゲーム画面と重ならない位置へ移動する
  process.stdout.write(`\x1b[${BOARD_HEIGHT + 2};1H`);
}
```

1. `running`を`false`にして二重実行を防ぐ
2. `clearInterval()`で自動落下を止める
3. 必要ならゲームオーバーメッセージを描く
4. Rawモードとカーソル表示を元へ戻す
5. 次のシェルプロンプトが盤面と重ならない位置へカーソルを移す


## 7. おわりに――ターミナルは文字を表示するだけではない

ここまで、ターミナル上で動くテトリスを機能ごとに分けて実装してきました。使ったのは、標準入力、標準出力、タイマー、配列といったNode.jsの基本的な機能です。ターミナルの機能を利用することで、文字を任意の位置へ出力し、色を付け、キー入力に応じて画面を書き換え、1つのゲームとして動かすことができました。

ターミナルは、プログラムが出力した文字を下方向へ順に表示するだけの画面ではありません。エスケープシーケンスを解釈する画面であり、キー操作をバイト列としてプログラムへ渡す入力装置（コントローラー）でもあります。ターミナルの向こう側で何が起きているかを知ると、普段使っているシェルや対話型アプリケーションも、何か違って見えてくるのではないでしょうか。

最後に、読者への宿題としてゲームをよりリッチにする改善案をまとめておきます。

- 消した行数に応じて落下速度を上げる
- 得点ルールを追加する
- 盤面サイズを変更できるようにする
- 出力をまとめてちらつきを抑える
