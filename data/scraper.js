const axios = require("axios");
const { MongoClient } = require("mongodb");
const cron = require("node-cron");

const uri =
  "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/?retryWrites=true&w=majority";
const dbName = "literature_db";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const API_URL = "https://vi.wikipedia.org/w/api.php";
const PAGE_TITLES = ["Chí Phèo", "Cô bé bán diêm", "Chiếc lá cuối cùng"]; // Danh sách các tác phẩm cần thu thập

async function fetchPageData(title) {
  try {
    const response = await axios.get(API_URL, {
      params: {
        action: "query",
        format: "json",
        prop: "extracts",
        explaintext: true,
        titles: title,
      },
    });

    const pages = response.data.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pageId === "-1") {
      console.log(`Không tìm thấy: ${title}`);
      return null;
    }

    return {
      pageid: pages[pageId].pageid,
      title: pages[pageId].title,
      text: pages[pageId].extract,
    };
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu từ API:", error);
    return null;
  }
}

async function saveToDatabase(data) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const worksCollection = db.collection("works");
    const sectionsCollection = db.collection("sections");

    const normalized = normalizeData(data);

    const existingWork = await worksCollection.findOne({
      pageid: normalized.pageid,
    });
    if (existingWork) {
      console.log(`Đã tồn tại: ${normalized.title}`);
      return;
    }

    const workDoc = {
      pageid: normalized.pageid,
      title: normalized.title,
      introduction: normalized.introduction,
      metadata: normalized.metadata,
      createdAt: new Date(),
    };

    const workResult = await worksCollection.insertOne(workDoc);
    const workId = workResult.insertedId;

    if (normalized.sections.length > 0) {
      const sectionDocs = normalized.sections.map((sec) => ({
        workId,
        heading: sec.heading,
        content: sec.content,
        createdAt: new Date(),
      }));
      await sectionsCollection.insertMany(sectionDocs);
    }

    console.log(`✅ Đã lưu: ${normalized.title}`);
  } catch (error) {
    console.error("Lỗi khi lưu vào MongoDB:", error);
  } finally {
    await client.close();
  }
}

function normalizeData(data) {
  const text = data.text.trim();
  const cleanText = text.replace(/\r\n/g, "\n");

  const parts = cleanText.split(/\n==\s*(.+?)\s*==\n/);
  const introduction = parts[0].trim();
  const sections = [];

  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].trim();
    const content = parts[i + 1] ? parts[i + 1].trim() : "";
    sections.push({ heading, content });
  }

  return {
    pageid: data.pageid,
    title: data.title,
    introduction,
    sections,
    metadata: {
      source: "vi.wikisource.org",
    },
  };
}

async function scrapeAndSave() {
  console.log("🔍 Bắt đầu thu thập dữ liệu...");
  for (const title of PAGE_TITLES) {
    const pageData = await fetchPageData(title);
    if (pageData) {
      await saveToDatabase(pageData);
    }
  }
  console.log("✅ Hoàn tất thu thập dữ liệu!");
}

// Chạy thu thập ngay khi khởi động
scrapeAndSave();

// Chạy tự động mỗi ngày lúc 00:00 (giờ máy chủ)
cron.schedule("0 0 * * *", scrapeAndSave);
