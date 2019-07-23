# twsv : @neos21/twsv

Twitter の画像・動画をダウンロードする CLI ツール。

[![NPM Version](https://img.shields.io/npm/v/@neos21/twsv.svg)](https://www.npmjs.com/package/@neos21/twsv)

ツイートするだけの CLI ツール。


## Installation

```sh
$ npm install -g @neos21/twsv

# Set credentials
export TWITTER_CONSUMER_KEY='Your Consumer Key'
export TWITTER_CONSUMER_SECRET='Your Consumer Secret'
export TWITTER_ACCESS_TOKEN_KEY='Your Access Token Key'
export TWITTER_ACCESS_TOKEN_SECRET='Your Access Token Secret'
```


## How To Use

```sh
# 指定ユーザのタイムラインより直近200件のツイートを取得し、それらに紐付く画像・動画を取得する
$ twsv https://twitter.com/USERNAME

# 指定のユーザのいいね一覧より直近200件のツイートを取得し、それらに紐付く画像・動画を取得する
$ twsv https://twitter.com/USERNAME/likes

# 指定のツイートから画像・動画を取得する
$ twsv https://twitter.com/USERNAME/status/0000000000000000000
```

コマンドを実行した時のカレントディレクトリに `twsv-downloads/` ディレクトリを作り、その下にファイルを保存する。


## Author

[Neo](http://neo.s21.xrea.com/) ([@Neos21](https://twitter.com/Neos21))

- [GitHub - twsv](https://github.com/Neos21/twsv)
- [npm - @neos21/twsv](https://www.npmjs.com/package/@neos21/twsv)


## Links

- [Neo's World](http://neo.s21.xrea.com/)
- [Corredor](http://neos21.hatenablog.com/)
- [Murga](http://neos21.hatenablog.jp/)
- [El Mylar](http://neos21.hateblo.jp/)
- [Neo's GitHub Pages](https://neos21.github.io/)
- [GitHub - Neos21](https://github.com/Neos21/)
