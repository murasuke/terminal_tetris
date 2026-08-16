## 6. 描画・入力・時間をゲームループにつなぐ

これまでの章で、テトリスに必要な部品を個別に作りました。

- ターミナルの任意の位置へ色付きの文字を描く
- Rawモードでキー入力を即座に受け取る
- 盤面とテトリミノを二次元配列で表す
- ブロックの移動、回転、衝突、固定、行消去を処理する

最後に、これらを一つのゲームとしてつなぎます。テトリスの状態が変化するきっかけは、プレイヤーのキー入力と、一定間隔で発生する自動落下の二つです。どちらも同じ更新処理へ渡し、判定と描画の順序を一か所にまとめます。

### 6.1 キー入力とタイマーを同じ更新処理へ集める

一般的なゲームでは、入力、状態更新、描画を繰り返す処理を**ゲームループ**と呼びます。今回のプログラムでは `while (true)` のようなループを回し続けるのではなく、Node.jsのイベントを利用します。

```text
キー入力 ─────┐
              ├─→ 状態を更新する関数 ─→ 衝突判定 ─→ 描画
タイマー ─────┘
```

キーが押されると標準入力の `data`イベントが発生し、一定時間が経過すると `setInterval()`のコールバックが呼び出されます。Node.jsのイベントループはこれらのコールバックを一つずつ実行するため、盤面を同時に書き換えて競合することはありません。

#### ゲームの状態を用意する

まず、ゲーム中に変化する値を用意します。

```js
const TICK_INTERVAL = 500; // ブロックが1段落下する間隔（ミリ秒）

let board = initializeBoard(); // 外周の壁と固定済みブロックを保持する盤面
let currentBlock; // 現在落下しているテトリミノの二次元配列
let x; // 現在のテトリミノ左上の横位置（セル単位）
let y; // 現在のテトリミノ左上の縦位置（セル単位）
let score = 0; // 消去した行数を加算する得点
let timer = null; // 自動落下を実行するsetIntervalのタイマーID
let running = true; // キー入力とタイマーによる状態更新を受け付けるか
```

固定済みブロックは `board`、落下中のブロックは `currentBlock`と座標 `x`、`y`で管理します。`score`には消した行数を加算し、`timer`には自動落下用タイマーを保持します。

新しいブロックは、7種類の定義からランダムに選び、盤面の上部中央へ配置します。

```js
function getRandomBlock() {
  const names = Object.keys(BLOCKS);
  const name = names[Math.floor(Math.random() * names.length)];
  return BLOCKS[name];
}

function newBlock() {
  const block = getRandomBlock();
  // ブロックの左上位置を、左右の壁を含む盤面の中央に合わせる
  const x = Math.floor((BOARD_WIDTH - block[0].length) / 2);
  const y = 1;

  return { block, x, y };
}
```

`BOARD_WIDTH`には左右の壁も含まれますが、ブロックの幅を差し引いて中央を求めれば、壁の内側へ配置できます。`y = 1`は、上側の壁のすぐ下です。

#### 盤面をまとめて描き直す

ゲーム開始時や行を消した後には、画面を消去してから盤面と得点を描き直します。

```js
function displayScore() {
  draw(0, BOARD_HEIGHT, `SCORE: ${score}`, 37);
}

function redrawBoard() {
  resetScreen();
  drawBlock(0, 0, board);
  displayScore();
}
```

落下中のブロックは `board`へまだ書き込まれていないため、盤面を描いた後に別途 `drawBlock(x, y, currentBlock)`で描きます。

#### タイマーを「下キー」として扱う

キー入力は、第4章で作成した `handleKeyPress()`へ渡します。

```js
process.stdin.on('data', (key) => {
  handleKeyPress(key);
});
```

自動落下も別の処理として実装する必要はありません。一定時間ごとに、下キーと同じ文字列を `handleKeyPress()`へ渡します。

```js
timer = setInterval(() => {
  handleKeyPress('\u001b[B'); // ↓キーと同じ入力
}, TICK_INTERVAL);
```

これにより、プレイヤーが下キーを押した場合も、500ミリ秒が経過した場合も、同じ衝突判定と落下処理が実行されます。落下方法を変更するときも、一つの処理だけを修正すれば済みます。

### 6.2 落下、固定、行消去、新しいブロック生成の流れ

キー入力を受け取ったら、第5章の `tryMove()`と `tryRotate()`を使って状態を更新します。

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

左右移動と回転は、移動先に衝突した場合は何もせず、現在の状態を維持します。下移動だけは意味が異なります。下へ動かせないことは、ブロックが底または積まれたブロックへ到達したことを表すため、現在のブロックを盤面へ固定します。

ブロックが下へ移動できなくなってから、次のブロックを操作できるようになるまでの流れは次のとおりです。

1. 現在のブロックを盤面へ固定する
2. 揃った行を消し、得点を加算する
3. 固定後の盤面を描き直す
4. 新しいブロックを生成する
5. 新しいブロックを置けるか判定する
6. 置ける場合は描画し、置けない場合はゲームオーバーにする

この処理を `lockCurrentBlock()`へまとめます。

```js
function lockCurrentBlock() {
  // 1. 落下中のブロックを盤面へ固定する
  placeBlock(board, currentBlock, x, y);

  // 2. 揃った行を消して得点へ加算する
  const linesCleared = clearLines(board);
  score += linesCleared;

  // 3. 固定後の盤面と得点を描き直す
  redrawBoard();

  // 4～6. 次のブロックを生成する
  if (!spawnNextBlock()) {
    finishGame('GAME OVER');
  }
}
```

行を消すと、その上にあるすべてのブロックが下へ移動します。空白による部分消去だけでは多数のセルを書き換える必要があるため、このタイミングでは画面全体を消去して `board`を描き直します。

得点は、分かりやすさを優先し、消した行数をそのまま加算します。

```text
1行消去   → 1点
2行同時消去 → 2点
```

同時に消した行数や落下速度に応じて得点を変える場合も、`linesCleared`を使って計算できます。

#### 新しいブロックを生成する

新しいブロックの生成とゲームオーバー判定は、`spawnNextBlock()`へまとめます。

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

代入式全体を丸括弧で囲んでいるのは、オブジェクトの分割代入を既存の変数へ行うためです。

```js
({ block: currentBlock, x, y } = newBlock());
```

`newBlock()`が返すプロパティ `block`を `currentBlock`へ、`x`と`y`を同名の変数へ代入しています。

### 6.3 ゲームオーバーまで動かしてみる

テトリスでは、積まれたブロックが盤面上部まで到達し、新しく生成したブロックを初期位置へ置けなくなるとゲームオーバーです。

この判定のために新しい条件を作る必要はありません。`spawnNextBlock()`で、生成直後の位置に対して `isCollision()`を呼び出します。

```text
新しいブロックを生成
        │
        ▼
初期位置で衝突するか
   ┌────┴────┐
  しない      する
   │           │
   ▼           ▼
ゲーム続行   ゲームオーバー
```

#### タイマーと入力を停止する

ゲームオーバーまたは `Ctrl+C`で終了するときは、タイマーを止め、Rawモードとカーソル表示を元へ戻します。二重に終了処理が走っても問題が起きないよう、`running`で状態を確認します。

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

`restoreTerminal()`は第4章で作成した、Rawモードを解除してカーソルを再表示する関数です。`process.exit()`で直ちに終了するのではなく、標準入力を `pause()`し、タイマーを解除することで、Node.jsのイベントループが自然に終了できる状態にします。

#### ゲームを開始する

最後に、初期化からイベント登録までを `main()`へまとめます。

```js
function main() {
  // 予期しない終了時にもターミナルを元へ戻す
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

プログラムを起動すると、まず盤面と最初のブロックが描画されます。その後は、キー入力またはタイマーが発生するたびに、次の処理を繰り返します。

1. 入力に対応する移動または回転を試す
2. 移動先や回転後の形が衝突しないか判定する
3. 問題がなければ状態を更新して描画する
4. 下へ移動できなければ固定、行消去、新規生成を行う
5. 新しいブロックを置けなければゲームを終了する

ここで動いているのは、特別なゲーム用APIではありません。標準入力、標準出力、タイマー、配列というNode.jsの基本機能をつないだものです。ターミナルが画面とコントローラーになり、JavaScriptが盤面の状態とゲームのルールを管理することで、一つのテトリスとして動作します。
