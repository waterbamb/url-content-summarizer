# URL Content Summarizer

URL内容摘要API - 输入任意URL，返回文章摘要、关键词、阅读时间

## 功能

- 网页内容自动提取
- 智能摘要生成
- 关键词提取（TF-IDF算法）
- 阅读时间估算
- 支持中英文内容

## API 使用

### 端点

```
GET /api/index?url=<URL>&summaryLength=<short|medium|long>
```

### 参数

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| url | 目标URL（必填） | - | https://example.com/article |
| summaryLength | 摘要长度 | medium | short/medium/long |
| userId | 用户ID（付费） | demo | 用户唯一标识 |

### 返回示例

```json
{
  "success": true,
  "url": "https://example.com/article",
  "title": "Article Title",
  "summary": "Key points from the article...",
  "keywords": [
    { "word": "technology", "count": 15 },
    { "word": "ai", "count": 12 }
  ],
  "readingTime": {
    "words": 1500,
    "minutes": 8,
    "text": "8 min read"
  },
  "stats": {
    "wordCount": 1500,
    "imagesCount": 5,
    "linksCount": 20
  }
}
```

## 定价

- 单次分析：$0.05
- 支持免费demo模式（demo=true）

## 收入预估

| 日均调用 | 日收入 | 月收入 |
|----------|--------|--------|
| 100次 | $5 | $150 |
| 500次 | $25 | $750 |
| 1000次 | $50 | $1,500 |

## 本地测试

```bash
curl "http://localhost:3000/api/index?url=https://example.com&demo=true"
```

## 许可证

MIT
