# SNSアカウントアイコン仕様

「ついていくのが精一杯」の全SNS共通プロフィールアイコン。

## コンセプト

急上昇するトレンド矢印（＝目まぐるしく進化するAI・IT）に、白い丸キャラクターが ＞＜ の目・食いしばった歯・汗で必死にしがみつき、よじ登っている。「精一杯ついていく」状態を、文字を使わずに表情とポーズだけで伝える。

- 文字を入れない: 40px 程度の小サイズでも潰れず、言語に依存しないため
- 円形切り抜き前提: 全要素を中心から半径約460px（1024px基準）の内側に収めている

## 配色

| 用途 | カラー |
| :--- | :--- |
| 背景（放射グラデーション） | `#FFE45C` → `#FFB627` |
| トレンド矢印 | `#FF4D2E` |
| 線・輪郭 | `#1E1B2E` |
| キャラクター本体 | `#FFFFFF` |
| 汗 | `#5BC8FF` |
| ほっぺ | `#FF8A80` |

## ファイル

| ファイル | 用途 |
| :--- | :--- |
| `remotion/public/brand/icon.svg` | マスターデータ（編集はこれを直す） |
| `remotion/public/brand/icon-1024.png` | YouTube / TikTok / Instagram のアップロード用 |
| `remotion/public/brand/icon-512.png` | 汎用 |
| `remotion/public/brand/icon-400.png` | X のアップロード用（推奨 400×400） |

## PNG の再書き出し

ImageMagick 等は未導入のため、Google Chrome のヘッドレスモードで書き出す。

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --window-size=1024,1024 --screenshot=$PWD/remotion/public/brand/icon-1024.png file://$PWD/remotion/public/brand/icon.svg
```

512 / 400 サイズは `<img src="icon.svg" width="512">` だけを置いたHTMLを同じ要領でスクリーンショットする。
