/**
 * Blue Belt Blues — 問い合わせ自動下書き作成スクリプト (Google Apps Script)
 *
 * 問い合わせ受信用Gmailに常駐させ、Formspreeからの新着通知メールを検知して
 * Claude APIで返信文を生成し、Gmailの下書きとして作成する。
 * 下書きのみを作成し、送信は人間が内容を確認してから行う。
 *
 * セットアップ手順は同ディレクトリの README.md を参照。
 */

// ==========================================
// エントリーポイント（時間主導トリガーに設定する）
// ==========================================
function processInquiries() {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('Script Properties に OPENAI_API_KEY が設定されていません。');
  }
  var model = props.getProperty('OPENAI_MODEL') || 'gpt-4o-mini';
  var labelName = props.getProperty('LABEL_NAME') || 'bbb-auto-drafted';
  var reviewLabelName = props.getProperty('REVIEW_LABEL_NAME') || 'bbb-needs-review';
  var maxThreads = Number(props.getProperty('MAX_THREADS') || 10);

  var doneLabel = getOrCreateLabel_(labelName);
  var reviewLabel = getOrCreateLabel_(reviewLabelName);

  var query =
    'from:(formspree.io) is:unread -label:' + labelName + ' -label:' + reviewLabelName;
  var threads = GmailApp.search(query, 0, maxThreads);

  threads.forEach(function (thread) {
    try {
      var target = getLatestUnreadMessage_(thread);
      if (!target) return;

      var fields = parseFormspreeFields_(target.getPlainBody());
      if (!fields.email || !fields.name) {
        // 必須フィールドが取れなかった場合は人間の確認に回す
        thread.addLabel(reviewLabel);
        target.markRead();
        return;
      }

      var draft = draftReplyWithOpenAI_(apiKey, model, fields);
      GmailApp.createDraft(fields.email, draft.subject, draft.body);

      target.markRead();
      thread.addLabel(doneLabel);
    } catch (err) {
      console.error('問い合わせ処理に失敗: ' + err);
      try {
        thread.addLabel(reviewLabel);
      } catch (e2) {
        // ラベル付与にも失敗した場合はログのみ
      }
    }
  });
}

// ==========================================
// 初回セットアップ用ヘルパー
// ==========================================

// 1時間おきに processInquiries を実行するトリガーを作成する。一度だけ実行すればよい。
function createTrigger() {
  ScriptApp.newTrigger('processInquiries').timeBased().everyHours(1).create();
}

// 直近のFormspree通知メールの本文をログに出す。
// Formspreeの実際のメール形式を確認し、必要なら parseFormspreeFields_ を調整するために使う。
function debugDumpLatestFormspreeEmail() {
  var threads = GmailApp.search('from:(formspree.io)', 0, 1);
  if (threads.length === 0) {
    Logger.log('Formspreeからのメールが見つかりません。');
    return;
  }
  var messages = threads[0].getMessages();
  var msg = messages[messages.length - 1];
  Logger.log(msg.getPlainBody());
}

// ==========================================
// 内部処理
// ==========================================

function getLatestUnreadMessage_(thread) {
  var messages = thread.getMessages();
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messages[i].isUnread()) return messages[i];
  }
  return null;
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

// Formspreeの通知メール本文から name/email/experience/belt/message を抽出する。
// Formspreeのメールテンプレートは "キー\n値" または "キー: 値" のどちらの形式でも届きうるため、
// 両対応のゆるい解析にしてある。実際のメールを見て必要なら調整すること。
function parseFormspreeFields_(text) {
  var keys = ['name', 'email', 'experience', 'belt', 'message'];
  var fields = {};
  var lines = String(text).replace(/\r\n/g, '\n').split('\n');

  var currentKey = null;
  var buffer = [];

  function flush() {
    if (currentKey) {
      fields[currentKey] = buffer.join('\n').trim();
    }
    buffer = [];
  }

  var footerPattern = /^(_{3,}|-{3,}|Powered by Formspree|View (it |this submission)|Reply to this email)/i;

  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var trimmed = raw.trim();
    var matchedKey = null;
    var inlineValue = '';

    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var lower = trimmed.toLowerCase();
      if (lower === key) {
        matchedKey = key;
        inlineValue = '';
        break;
      }
      var colonMatch = trimmed.match(new RegExp('^' + key + '\\s*:\\s*(.*)$', 'i'));
      if (colonMatch) {
        matchedKey = key;
        inlineValue = colonMatch[1];
        break;
      }
    }

    if (matchedKey) {
      flush();
      currentKey = matchedKey;
      buffer = inlineValue ? [inlineValue] : [];
      continue;
    }

    if (currentKey) {
      if (footerPattern.test(trimmed)) {
        flush();
        currentKey = null;
        continue;
      }
      buffer.push(raw);
    }
  }
  flush();

  return fields;
}

// OpenAI APIを呼び出し、問い合わせ内容に応じた返信の件名・本文を生成する。
function draftReplyWithOpenAI_(apiKey, model, fields) {
  var systemPrompt = [
    'あなたは柔術サークル「Blue Belt Blues」(千葉県流山市)の代表・桐生宜昭です。',
    '体験・見学の問い合わせに対する返信メールの下書きを、桐生宜昭本人になりきって日本語で書いてください。',
    '',
    '# サークルの事実（これ以外の情報を断定して書かないこと）',
    '- インストラクターはいない。参加者同士が技を見せ合い、自主的に学ぶスタイル。',
    '- 固定スケジュールはなく、参加者が集まれる日程をその都度調整して施設を予約する。',
    '- 練習場所は千葉県流山市内の公共施設（流山市北部柔道場、キッコーマンアリーナ）。',
    '- 月会費はなく、1回あたり施設利用料の割り勘で300〜500円。当日、現金またはPayPayで支払う。',
    '- 事前予約があれば、見学・体験はいつでも無料で参加可能。',
    '',
    '# 文面の型（過去の返信スタイルに合わせること）',
    '- 書き出しは「{お名前}様\\n\\nはじめまして。柔術サークル「Blue Belt Blues」代表の桐生宜昭です。」',
    '  （お名前が不明な場合は宛名行を省略してよい）。',
    '- 続けて「この度は、当サークルにお問い合わせいただき誠にありがとうございます。」',
    '  「個人メールより失礼いたします。」の2文を入れる。',
    '- 参加希望を受け取った旨を一言で述べる（例:「練習参加のご希望、承りました。ぜひお待ちしております。」）。',
    '- 次回の日時・場所は自分（AI）は把握していないため、具体的な日付をでっち上げず、',
    '  本文中に次の2行をそのままプレースホルダーとして残すこと。桐生が送信前に手で埋める想定。',
    '    - 日時：【次回の練習日時を記入】',
    '    - 場所：【流山市北部柔道場 または キッコーマンアリーナ を記入】',
    '- 参加費の行は事実が決まっているので具体的に書く:',
    '  「参加費：施設利用料の割り勘として1回あたり300〜500円（当日現金またはPayPayでお支払いください）」',
    '- 上記の後に、ほぼ定型文として次の一文を必ず入れる:',
    '  「当サークルは決まったインストラクターを置かず、参加者同士で自主的に練習するスタイルです。」',
    '- その上で、問い合わせ内容（経験有無・帯・メッセージ本文）に触れて一言パーソナライズする',
    '  （例: 経験者なら得意技や研究したいポジションを尋ねる、未経験者なら気負わず来てよい旨を伝える、',
    '  メッセージ本文に質問があればそれに答える）。',
    '- 結びは「ご不明な点ございましたら、本メールにそのままご返信ください。」',
    '  「それでは、お会いできるのを楽しみにしております。」の2文。',
    '- 本文の最後に「Blue Belt Blues」等の署名ブロックは付けない（名乗りは冒頭のみでよい）。',
    '',
    '# トーン・文体のルール',
    '- 丁寧だが簡潔。誇張や営業的な煽り文句は書かない。',
    '- 「指導します」「教えます」など、インストラクターがいるかのような表現は絶対に使わない。',
    '',
    '出力は次のJSON形式のみで答えること。他のテキストやコードブロックは一切付けないこと。',
    '{"subject": "件名", "body": "本文"}'
  ].join('\n');

  var userPrompt = [
    'お名前: ' + (fields.name || '(不明)'),
    'メールアドレス: ' + (fields.email || '(不明)'),
    '柔術経験: ' + (fields.experience || '(不明)'),
    '帯: ' + (fields.belt || '(不明)'),
    'メッセージ: ' + (fields.message || '(なし)')
  ].join('\n');

  var payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' }
  };

  var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      'OpenAI APIエラー: ' + response.getResponseCode() + ' ' + response.getContentText()
    );
  }

  var json = JSON.parse(response.getContentText());
  var text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!text) throw new Error('OpenAI APIから本文が返りませんでした。');

  // モデルがコードフェンスを付けてしまった場合の保険
  var cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');

  var parsed = JSON.parse(cleaned);
  if (!parsed.subject || !parsed.body) {
    throw new Error('OpenAIの出力にsubject/bodyが含まれていません。');
  }
  return parsed;
}
