/**
 * ツイート画像ジェネレーター
 *
 * 入力画面で受け取った内容を Canvas 2D API でツイート風に描画し、
 * 生成結果画面での表示と PNG ダウンロードを行う。
 * 外部ライブラリには依存しない。
 */
(function () {
  'use strict';

  // ---- 描画レイアウト定数（CSS ピクセル単位） ----
  const CANVAS_WIDTH = 598;
  const PIXEL_RATIO = 2; // 高解像度で書き出すための倍率
  const PADDING_X = 16;
  const PADDING_TOP = 12;
  const AVATAR_SIZE = 40;
  const HEADER_GAP = 12;
  const BODY_FONT_SIZE = 17;
  const BODY_LINE_HEIGHT = 24;
  const META_FONT_SIZE = 15;
  const ACTION_ROW_HEIGHT = 48;
  const ICON_SIZE = 22;

  const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif';

  const THEMES = {
    light: {
      background: '#ffffff',
      text: '#0f1419',
      sub: '#536471',
      border: '#eff3f4',
      link: '#1d9bf0',
    },
    dark: {
      background: '#000000',
      text: '#e7e9ea',
      sub: '#71767b',
      border: '#2f3336',
      link: '#1d9bf0',
    },
  };

  // アクション行のアイコン（24x24 グリッドの SVG パス。線で描画する）
  const ACTION_ICON_PATHS = [
    // 返信
    'M4.5 5h15A2.5 2.5 0 0 1 22 7.5v8a2.5 2.5 0 0 1-2.5 2.5H12l-5.5 4v-4h-2A2.5 2.5 0 0 1 2 15.5v-8A2.5 2.5 0 0 1 4.5 5z',
    // リポスト
    'M3 7.5 6.5 4 10 7.5M6.5 4v11a2.5 2.5 0 0 0 2.5 2.5h4.5M21 16.5 17.5 20 14 16.5M17.5 20V9a2.5 2.5 0 0 0-2.5-2.5h-4.5',
    // いいね
    'M12 20.5S3.5 15.6 3.5 9.6A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.5 2.4c0 6-8.5 10.9-8.5 10.9z',
    // ブックマーク
    'M6 3.5h12v17l-6-4.4-6 4.4z',
    // 共有
    'M12 3v12.5M7 8l5-5 5 5M4 14.5v4A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-4',
  ];

  // 行頭に来てはいけない文字（簡易的な禁則処理用）
  const NO_LINE_START = new Set(Array.from('、。，．,.・：；:;？！?!ー～…‥）」』】〕〉》］｝)]}ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ'));

  // 本文中で色付け（リンク色）する部分: URL / ハッシュタグ / メンション
  const HIGHLIGHT_PATTERN = /(https?:\/\/[^\s]+|[#＃][\p{L}\p{N}_]+|@[A-Za-z0-9_]{1,15})/gu;
  const USER_ID_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : null;

  // ---- DOM 要素 ----
  const inputScreen = document.getElementById('input-screen');
  const resultScreen = document.getElementById('result-screen');
  const form = document.getElementById('tweet-form');
  const avatarInput = document.getElementById('avatar-input');
  const avatarPreview = document.getElementById('avatar-preview');
  const avatarPlaceholder = document.getElementById('avatar-placeholder');
  const avatarClear = document.getElementById('avatar-clear');
  const nameInput = document.getElementById('name-input');
  const idInput = document.getElementById('id-input');
  const bodyInput = document.getElementById('body-input');
  const bodyCount = document.getElementById('body-count');
  const canvas = document.getElementById('tweet-canvas');
  const downloadButton = document.getElementById('download-button');
  const backButton = document.getElementById('back-button');

  /** 選択中のアイコン画像（未選択時は null） */
  let avatarImage = null;
  let avatarObjectUrl = null;
  /** 直近に生成したツイートの入力内容 */
  let currentTweet = null;

  // ---- アイコン画像 ----

  avatarInput.addEventListener('change', function () {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      avatarInput.value = '';
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = function () {
      releaseAvatarUrl();
      avatarObjectUrl = url;
      avatarImage = image;
      avatarPreview.src = url;
      avatarPreview.hidden = false;
      avatarPlaceholder.hidden = true;
      avatarClear.hidden = false;
    };
    image.onerror = function () {
      URL.revokeObjectURL(url);
      alert('画像を読み込めませんでした。別の画像を選択してください。');
      avatarInput.value = '';
    };
    image.src = url;
  });

  avatarClear.addEventListener('click', function () {
    releaseAvatarUrl();
    avatarImage = null;
    avatarInput.value = '';
    avatarPreview.removeAttribute('src');
    avatarPreview.hidden = true;
    avatarPlaceholder.hidden = false;
    avatarClear.hidden = true;
  });

  function releaseAvatarUrl() {
    if (avatarObjectUrl) {
      URL.revokeObjectURL(avatarObjectUrl);
      avatarObjectUrl = null;
    }
  }

  // ---- 入力チェック ----

  bodyInput.addEventListener('input', function () {
    bodyCount.textContent = String(bodyInput.value.length);
  });

  // 入力欄の先頭に「@」があらかじめ表示されているため、入力された @ は取り除く
  idInput.addEventListener('input', function () {
    const normalized = idInput.value.replace(/^[@＠]+/, '');
    if (normalized !== idInput.value) {
      idInput.value = normalized;
    }
  });

  // 入力し直したらエラー表示を消す
  [
    [nameInput, 'name-error'],
    [idInput, 'id-error'],
    [bodyInput, 'body-error'],
  ].forEach(function (pair) {
    pair[0].addEventListener('input', function () {
      if (pair[0].getAttribute('aria-invalid') === 'true') {
        setError(pair[0], pair[1], '');
      }
    });
  });

  /** ユーザーID の先頭に付けられた @ を取り除く */
  function normalizeUserId(value) {
    return value.trim().replace(/^[@＠]/, '');
  }

  function setError(input, errorId, message) {
    const errorElement = document.getElementById(errorId);
    if (message) {
      errorElement.textContent = message;
      errorElement.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorId);
    } else {
      errorElement.textContent = '';
      errorElement.hidden = true;
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  /** 入力内容を検証し、問題がなければツイートデータを返す */
  function validateForm() {
    const name = nameInput.value.trim();
    const userId = normalizeUserId(idInput.value);
    const body = bodyInput.value.replace(/\r\n?/g, '\n');
    let firstInvalid = null;

    if (!name) {
      setError(nameInput, 'name-error', 'ユーザー名を入力してください。');
      firstInvalid = firstInvalid || nameInput;
    } else {
      setError(nameInput, 'name-error', '');
    }

    if (!userId) {
      setError(idInput, 'id-error', 'ユーザーIDを入力してください。');
      firstInvalid = firstInvalid || idInput;
    } else if (!USER_ID_PATTERN.test(userId)) {
      setError(idInput, 'id-error', 'ユーザーIDは半角英数字とアンダースコア（_）の 15 文字以内で入力してください。');
      firstInvalid = firstInvalid || idInput;
    } else {
      setError(idInput, 'id-error', '');
    }

    if (!body.trim()) {
      setError(bodyInput, 'body-error', '本文を入力してください。');
      firstInvalid = firstInvalid || bodyInput;
    } else {
      setError(bodyInput, 'body-error', '');
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    const themeInput = form.querySelector('input[name="theme"]:checked');
    return {
      avatar: avatarImage,
      name: name,
      userId: userId,
      body: body,
      theme: themeInput ? themeInput.value : 'light',
      createdAt: new Date(),
    };
  }

  // ---- 画面遷移 ----

  function showScreen(screen) {
    const isResult = screen === 'result';
    inputScreen.hidden = isResult;
    resultScreen.hidden = !isResult;
    window.scrollTo(0, 0);
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const tweet = validateForm();
    if (!tweet) return;

    currentTweet = tweet;
    await renderTweet(canvas, tweet);
    showScreen('result');
    history.pushState({ screen: 'result' }, '', '#result');
    downloadButton.focus();
  });

  backButton.addEventListener('click', function () {
    if (history.state && history.state.screen === 'result') {
      history.back();
    } else {
      showScreen('input');
    }
  });

  window.addEventListener('popstate', function () {
    if (location.hash === '#result' && currentTweet) {
      showScreen('result');
    } else {
      showScreen('input');
    }
  });

  // 生成前に結果画面の URL を直接開いた場合は入力画面を表示する
  if (location.hash === '#result') {
    history.replaceState(null, '', location.pathname + location.search);
  }

  // ---- ダウンロード ----

  downloadButton.addEventListener('click', function () {
    if (!currentTweet) return;
    canvas.toBlob(function (blob) {
      if (!blob) {
        alert('画像の生成に失敗しました。');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tweet-' + currentTweet.userId + '-' + formatFileTimestamp(currentTweet.createdAt) + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
  });

  function formatFileTimestamp(date) {
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) +
      '-' + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
  }

  // ---- 描画処理 ----

  function font(weight, size) {
    return weight + ' ' + size + 'px ' + FONT_FAMILY;
  }

  /** 「午後3:24 · 2026年9月26日」形式の日時文字列を返す */
  function formatTweetDate(date) {
    const hours = date.getHours();
    const period = hours < 12 ? '午前' : '午後';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return period + hour12 + ':' + minutes + ' · ' +
      date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  /** 文字列を書記素（見た目上の 1 文字）単位に分割する */
  function splitGraphemes(text) {
    if (segmenter) {
      return Array.from(segmenter.segment(text), function (s) { return s.segment; });
    }
    return Array.from(text);
  }

  /**
   * 1 行分のテキストを、折り返し判定に使うトークン列に分割する。
   * 半角英数字記号の連続は単語として 1 トークン、それ以外は 1 文字ずつ。
   */
  function tokenizeLine(line, theme) {
    const tokens = [];
    const parts = line.split(HIGHLIGHT_PATTERN);
    parts.forEach(function (part, index) {
      if (!part) return;
      // split に捕獲グループを使っているため、奇数番目が色付け対象
      const color = index % 2 === 1 ? theme.link : theme.text;
      const chunks = part.match(/[\x21-\x7E]+|[ \t　]+|[^\x21-\x7E \t　]+/g) || [];
      chunks.forEach(function (chunk) {
        if (/^[\x21-\x7E]+$/.test(chunk)) {
          tokens.push({ text: chunk, color: color, space: false });
        } else if (/^[ \t　]+$/.test(chunk)) {
          tokens.push({ text: chunk.replace(/\t/g, '    '), color: color, space: true });
        } else {
          splitGraphemes(chunk).forEach(function (g) {
            tokens.push({ text: g, color: color, space: false });
          });
        }
      });
    });
    return tokens;
  }

  /** 本文を最大幅に収まるよう折り返し、行ごとのトークン配列を返す */
  function wrapBody(ctx, body, maxWidth, theme) {
    const lines = [];

    body.split('\n').forEach(function (rawLine) {
      let line = [];
      let lineWidth = 0;

      const pushLine = function () {
        // 折り返し位置の末尾空白は描画しない
        while (line.length && line[line.length - 1].space) {
          lineWidth -= line.pop().width;
        }
        lines.push(line);
        line = [];
        lineWidth = 0;
      };

      const addToken = function (token) {
        token.width = ctx.measureText(token.text).width;

        if (lineWidth + token.width <= maxWidth || line.length === 0) {
          if (token.width > maxWidth && line.length === 0 && !token.space) {
            // 1 トークンで最大幅を超える長い単語は 1 文字ずつに分解する
            splitGraphemes(token.text).forEach(function (g) {
              addToken({ text: g, color: token.color, space: false });
            });
            return;
          }
          line.push(token);
          lineWidth += token.width;
          return;
        }

        // ここから折り返しが必要なケース
        if (token.space) {
          // 空白で折り返す場合は空白を捨てて改行のみ行う
          pushLine();
          return;
        }

        if (token.width > maxWidth) {
          splitGraphemes(token.text).forEach(function (g) {
            addToken({ text: g, color: token.color, space: false });
          });
          return;
        }

        // 行頭禁則文字の場合は、直前の 1 文字を次の行へ送る
        let carried = null;
        if (NO_LINE_START.has(token.text) && line.length > 1) {
          const last = line[line.length - 1];
          if (!last.space && splitGraphemes(last.text).length === 1) {
            carried = line.pop();
            lineWidth -= carried.width;
          }
        }

        pushLine();
        if (carried) {
          line.push(carried);
          lineWidth += carried.width;
        }
        line.push(token);
        lineWidth += token.width;
      };

      ctx.font = font('400', BODY_FONT_SIZE);
      tokenizeLine(rawLine, theme).forEach(addToken);
      pushLine();
    });

    return lines;
  }

  /** 最大幅を超える場合は末尾を「…」で省略する */
  function truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const chars = splitGraphemes(text);
    while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) {
      chars.pop();
    }
    return chars.join('') + '…';
  }

  function drawAvatar(ctx, image, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (image) {
      // object-fit: cover 相当で正方形に切り抜く
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sx = (image.naturalWidth - side) / 2;
      const sy = (image.naturalHeight - side) / 2;
      ctx.drawImage(image, sx, sy, side, side, x, y, size, size);
    } else {
      // デフォルトアイコン
      const scale = size / 64;
      ctx.fillStyle = '#cfd9de';
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + 32 * scale, y + 25 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 12 * scale, y + 56 * scale);
      ctx.bezierCurveTo(x + 14 * scale, y + 44 * scale, x + 22 * scale, y + 38 * scale, x + 32 * scale, y + 38 * scale);
      ctx.bezierCurveTo(x + 42 * scale, y + 38 * scale, x + 50 * scale, y + 44 * scale, x + 52 * scale, y + 56 * scale);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawIcon(ctx, pathData, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.75;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(pathData));
    ctx.restore();
  }

  /** 折り返し済みの 1 行を、同じ色の連続部分ごとにまとめて描画する */
  function drawLine(ctx, tokens, x, y) {
    let cursor = x;
    let i = 0;
    while (i < tokens.length) {
      const color = tokens[i].color;
      let text = '';
      while (i < tokens.length && tokens[i].color === color) {
        text += tokens[i].text;
        i++;
      }
      ctx.fillStyle = color;
      ctx.fillText(text, cursor, y);
      cursor += ctx.measureText(text).width;
    }
  }

  /** ツイート画像を Canvas に描画する */
  async function renderTweet(target, tweet) {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const theme = THEMES[tweet.theme] || THEMES.light;
    const ctx = target.getContext('2d');
    const contentWidth = CANVAS_WIDTH - PADDING_X * 2;

    // 高さを決めるために先に本文を折り返す
    const bodyLines = wrapBody(ctx, tweet.body, contentWidth, theme);

    const headerBottom = PADDING_TOP + AVATAR_SIZE;
    const bodyTop = headerBottom + HEADER_GAP;
    const bodyBottom = bodyTop + bodyLines.length * BODY_LINE_HEIGHT;
    const dateTop = bodyBottom + 16;
    const dividerY = dateTop + 20 + 16;
    const height = dividerY + ACTION_ROW_HEIGHT + 4;

    target.width = CANVAS_WIDTH * PIXEL_RATIO;
    target.height = height * PIXEL_RATIO;
    ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
    ctx.textBaseline = 'middle';

    // 背景
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, height);

    // アイコン
    drawAvatar(ctx, tweet.avatar, PADDING_X, PADDING_TOP, AVATAR_SIZE);

    // ユーザー名・ユーザーID
    const headerX = PADDING_X + AVATAR_SIZE + 8;
    const headerMaxWidth = CANVAS_WIDTH - headerX - PADDING_X;
    ctx.font = font('700', META_FONT_SIZE);
    ctx.fillStyle = theme.text;
    ctx.fillText(truncateText(ctx, tweet.name, headerMaxWidth), headerX, PADDING_TOP + 10);
    ctx.font = font('400', META_FONT_SIZE);
    ctx.fillStyle = theme.sub;
    ctx.fillText(truncateText(ctx, '@' + tweet.userId, headerMaxWidth), headerX, PADDING_TOP + 30);

    // 本文
    ctx.font = font('400', BODY_FONT_SIZE);
    bodyLines.forEach(function (line, index) {
      drawLine(ctx, line, PADDING_X, bodyTop + index * BODY_LINE_HEIGHT + BODY_LINE_HEIGHT / 2);
    });

    // 投稿日時
    ctx.font = font('400', META_FONT_SIZE);
    ctx.fillStyle = theme.sub;
    ctx.fillText(formatTweetDate(tweet.createdAt), PADDING_X, dateTop + 10);

    // 区切り線
    ctx.fillStyle = theme.border;
    ctx.fillRect(PADDING_X, dividerY, contentWidth, 1);

    // アクションアイコン（左右端を揃えて均等配置）
    const iconY = dividerY + (ACTION_ROW_HEIGHT - ICON_SIZE) / 2;
    const step = (contentWidth - ICON_SIZE) / (ACTION_ICON_PATHS.length - 1);
    ACTION_ICON_PATHS.forEach(function (path, index) {
      drawIcon(ctx, path, PADDING_X + step * index, iconY, ICON_SIZE, theme.sub);
    });
  }
})();
