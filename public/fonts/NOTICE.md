# 本地字体说明

- `night-serif.woff2`：Noto Serif SC 的中文展示字形子集，用于主标题与少量强调文字。上游项目：[Noto Serif CJK](https://github.com/notofonts/noto-cjk)，发布页：[Google Fonts](https://fonts.google.com/noto/specimen/Noto+Serif+SC)。
- `night-data.woff2`：Space Grotesk 数据/拉丁字形子集，用于时间、数字及英文标识。上游项目：[Space Grotesk](https://github.com/floriankarsten/space-grotesk)，发布页：[Google Fonts](https://fonts.google.com/specimen/Space+Grotesk)。

两者采用 SIL Open Font License 1.1；通用许可全文随附于 `OFL.txt`，上游的具体版权声明保留于字体内部元数据。上述本地文件名仅是站点资源别名，不代表字体归本原型所有。

中文界面正文优先使用用户系统的现代中文无衬线字体，不会在运行时下载第三方字体。展示子集未收录的字符会回退至系统宋体/衬线字体。若后续增加标题，建议重新生成字体子集以保持统一。
