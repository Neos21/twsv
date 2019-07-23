#!/usr/bin/env node

/*! 引数で指定された Twitter URL よりツイートに紐付く画像・動画を特定してダウンロードする */

const fs    = require('fs');
const http  = require('http');
const https = require('https');
const path  = require('path');
const util  = require('util');

const fsWriteFile = util.promisify(fs.writeFile);

const twitter = require('twitter');
const requestPromise = require('request-promise');



// メイン処理
// ====================================================================================================

// Twitter Credentials
const credentials = {
  consumer_key       : '',
  consumer_secret    : '',
  access_token_key   : '',
  access_token_secret: '',
};

Object.keys(credentials).forEach((keyName) => {
  // 環境変数から Twitter Credentials を取得する
  const envName = `TWITTER_${keyName.toUpperCase()}`;
  if(process.env[envName]) {
    credentials[keyName] = process.env[envName];
  }
  
  // Credential 情報がない場合は中止する
  if(!credentials[keyName]) {
    console.error(`環境変数 ${envName} を設定してください`);
    return process.exit(1);
  }
});

// Twitter Client
const client = new twitter(credentials);

// URL : 第1引数で指定する
const url = process.argv[2];

if(!url) {
  console.error('引数で Twitter URL を指定してください');
  return process.exit(1);
}
else if(!isTwitterUrl(url)) {
  console.error('指定された URL が不正です');
  return process.exit(1);
}

// 保存先ディレクトリパス : 呼び出し元のカレントディレクトリ配下にディレクトリを作成し保存する
const saveDirectoryPath = `${process.cwd()}/twsv-downloads`;

(async () => {
  // Twitter API コール前に保存ディレクトリが作れるか確認する
  if(!canMakeSaveDirectory(saveDirectoryPath)) {
    console.error('保存先にファイルが存在するためディレクトリが作成できない', saveDirectoryPath);
    return process.exit(1);
  }
  
  // 入力された URL の種類別に画像・動画 URL を取得する
  let mediaUrls = [];
  if(isStatusUrl(url)) {
    console.log('ツイート1件');
    
    const tweetId = detectTweetId(url);
    if(!tweetId) {
      console.error('ツイート ID が拾えなかった', url);
      return process.exit(1);
    }
    
    let tweet = {};
    try {
      tweet = await fetchTweet(tweetId);
    }
    catch(error) {
      console.error('ツイート取得に失敗', error);
      return process.exit(1);
    }
    
    mediaUrls = collectMediaUrls(tweet);
  }
  else {
    const userName = detectUserName(url);
    if(!userName) {
      console.error('ユーザ名が拾えなかった', url);
      return process.exit(1);
    }
    
    let tweets = [];
    try {
      if(isLikesUrl(url)) {
        console.log('いいねツイート一覧');
        tweets = await fetchFavouriteTweets(userName);
      }
      else {
        console.log('タイムラインのツイート一覧');
        tweets = await fetchTimelineTweets(userName);
      }
    }
    catch(error) {
      console.error('ツイート一覧取得に失敗', error);
      return process.exit(1);
    }
    
    // ツイートごとに画像・動画 URL を拾い単一の配列にまとめる
    mediaUrls = tweets.reduce((accumulatorMediaUrls, tweet) => {
      const tweetMediaUrls = collectMediaUrls(tweet);
      return accumulatorMediaUrls.concat(tweetMediaUrls);
    }, []);
  }
  
  // 保存先ディレクトリがなければ作成する
  try {
    createSaveDirectory(saveDirectoryPath);
  }
  catch(error) {
    console.error('保存先ディレクトリの作成に失敗', error);
    return process.exit(1);
  }
  
  // ダウンロード処理
  await Promise.all(mediaUrls.map((mediaUrl) => {
    return downloadFile(mediaUrl);
  }));
  
  console.log('完了');
})();

// ====================================================================================================



/**
 * 保存先ディレクトリが作成できるか確認する
 * 
 * @param {string} saveDirectoryPath 保存先ディレクトリパス
 * @return ディレクトリが既に存在する場合、何も存在しておらず作成できる場合は true・ファイルが存在している場合は作成できないので false
 */
function canMakeSaveDirectory(saveDirectoryPath) {
  // ディレクトリ・ファイルが存在していない場合は true
  if(!fs.existsSync(saveDirectoryPath)) {
    return true;
  }
  
  // ディレクトリが存在していれば true・ファイルが存在している場合は作成できないので false
  return fs.statSync(saveDirectoryPath).isDirectory();
}

/**
 * 保存先ディレクトリがない場合は作成する
 * (保存先ディレクトリパスに何かが存在する場合、それがファイルかディレクトリかは canMakeSaveDirectory() で確認済)
 * 
 * @param {string} saveDirectoryPath 保存先ディレクトリパス
 * @throws ディレクトリが作成出来ない場合は fs.mkdirSync() で例外が発生する
 */
function createSaveDirectory(saveDirectoryPath) {
  if(!fs.existsSync(saveDirectoryPath)) {
    console.log(`${saveDirectoryPath} ディレクトリ未作成`);
    fs.mkdirSync(saveDirectoryPath);
  }
}



/**
 * Twitter の有効な URL かどうか判定する
 * 
 * @param {string} url URL
 * @return {boolean} Twitter の有効な URL なら true・そうでなければ false
 */
function isTwitterUrl(url) {
  // 'twitter.com/' を含むか、'/【指定文言】' で終わらない URL 文字列なら OK とする
  return url.includes('twitter.com/') &&
         !url.match(/\/(home|i|explore|notifications|messages|settings|lists|moments)$/u);
}

/**
 * ツイート1件の URL かどうか判定する
 * 
 * @param {string} url URL
 * @return {boolean} ツイート1件の URL なら true・そうでなければ false
 */
function isStatusUrl(url) {
  return url.includes('/status/');
}

/**
 * いいね一覧の URL かどうか判定する
 * 
 * @param {string} url URL
 * @return {boolean} いいね一覧の URL なら true・そうでなければ false
 */
function isLikesUrl(url) {
  return url.endsWith('/likes');
}



/**
 * URL からツイート ID のみを取得する
 * 
 * @param {string} url URL
 * @return {string} ツイート ID・うまく取得できなかった場合は空文字
 */
function detectTweetId(url) {
  const matches = url.match(/status\/([0-9]*)/u);
  return (matches === null) ? '' : matches[1];
}

/**
 * URL からユーザ名のみを取得する
 * 
 * @param {string} url URL
 * @return {string} ユーザ名・うまく取得できなかった場合は空文字
 */
function detectUserName(url) {
  const splits = url.split('/');
  const domainIndex = splits.findIndex((str) => {
    return str.includes('twitter.com');
  });
  // ドメインが見つからなければ空文字・ドメインの次の文字列がユーザ名
  return (domainIndex === -1) ? '' : splits[domainIndex + 1];
}



/**
 * ツイートを1件取得する
 * 
 * @param {string} tweetId ツイート ID
 * @return {*} ツイートオブジェクト
 */
function fetchTweet(tweetId) {
  return client.get('statuses/show', {
    id: tweetId
  });
}

/**
 * いいねのツイート一覧を取得する
 * 
 * @param {string} userName ユーザ名
 * @return {Array<*>} ツイートオブジェクトの配列
 */
function fetchFavouriteTweets(userName) {
  return client.get('favorites/list', {
    screen_name: userName,
    count: 200,
    include_entities: true
  });
}

/**
 * ツイート一覧を取得する
 * 
 * @param {string} userName ユーザ名
 * @return {Array<*>} ツイートオブジェクトの配列
 */
function fetchTimelineTweets(userName) {
  return client.get('statuses/user_timeline', {
    screen_name: userName,
    count: 200,              // リプライやリツイートを除外しても件数には影響しない
    include_entities: true,
    trim_user: false,        // ユーザ情報を除外しない
    exclude_replies: false,  // リプライを除外しない
    include_rts: true        // リツイートを含める
  });
}



/**
 * ツイートから画像・動画の直 URL を取得する
 * 
 * @param {*} tweet ツイートオブジェクト
 * @return {Array<string>} 直 URL リスト・メディアがない場合は空配列
 */
function collectMediaUrls(tweet) {
  // extended_entities.media[] プロパティがない場合は処理対象なし
  if(!tweet.extended_entities || !tweet.extended_entities.media || !tweet.extended_entities.media.length) {
    const userName = tweet.user ? tweet.user.screen_name : 'UNKNOWN';
    const tweetId = tweet.id_str || 'UNKNOWN';
    console.log('ツイートに画像・動画が付与されていない', `https://twitter.com/${userName}/status/${tweetId}`);
    return [];
  }
  
  const mediaUrls = [];
  tweet.extended_entities.media.forEach((media) => {
    if(media.video_info && media.video_info.variants && media.video_info.variants.length) {
      // 動画 : 最高画質の動画 URL を選んで格納する
      let currentBitrate = -1;
      let currentMediaUrl = '';
      console.log(JSON.stringify(media.video_info.variants, null, '  '));
      media.video_info.variants.forEach((variant) => {
        if(variant.content_type !== 'video/mp4') {
          return;  // m3u8 などを除外する
        }
        
        if(variant.bitrate !== undefined && variant.bitrate >= currentBitrate) {
          currentBitrate  = variant.bitrate;
          currentMediaUrl = variant.url;
        }
      });
      
      if(currentMediaUrl) {
        mediaUrls.push(currentMediaUrl.replace(/\.mp4.*$/u, '.mp4'));
      }
      else {
        console.warn('適切な動画 URL が見つからなかった', media.video_info.variants);
      }
    }
    else {
      // 画像
      mediaUrls.push(media.media_url);
    }
  });
  
  return mediaUrls;
}



/**
 * 同時接続数を制御するエージェント
 */
class SocketsAgent {
  /**
   * コンストラクタ
   * 
   * @param {number} maxSockets 最大同時接続数
   */
  constructor(maxSockets) {
    this.http = new http.Agent();
    this.https = new https.Agent();
    this.http.maxSockets = maxSockets;
    this.https.maxSockets = maxSockets;
  }
  
  /**
   * ソケットを取得する
   * 
   * @param {string} url URL
   * @return {*} http or https
   */
  get(url) {
    if(url.includes('https://')) {
      return this.https;
    }
    else if(url.includes('http://')) {
      return this.http;
    }
  }
}

// 同時接続数を制御する
const socketsAgent = new SocketsAgent(5);

/**
 * 画像・動画ファイルをダウンロードする
 * ファイル取得・保存に失敗した場合はログ出力のみで終了する
 * 
 * @param {string} mediaUrl 画像・動画の URL
 * @return {Promise<null>} ダウンロード完了
 */
function downloadFile(mediaUrl) {
  console.log(mediaUrl);
  return requestPromise.get({
    url: mediaUrl,
    encoding: null,
    timeout: 15000,
    headers: {
      // Windows Chrome の UA に偽装しておく
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
    },
    pool: socketsAgent.get(mediaUrl)
  })
    .then((binary) => {
      console.log('ダウンロード成功', mediaUrl);
      const fileName = path.basename(mediaUrl);
      return fsWriteFile(`${saveDirectoryPath}/${fileName}`, binary, 'binary');
    })
    .catch((error) => {
      console.error('ダウンロード失敗', mediaUrl, error);
    });
}