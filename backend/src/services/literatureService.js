const axios = require("axios");
const { MongoClient, ObjectId } = require("mongodb");
const geminiService = require("./geminiService");

const API_URL = "https://vi.wikipedia.org/w/api.php";
const uri =
  "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/literature_db?retryWrites=true&w=majority";
const dbName = "literature_db";
const client = new MongoClient(uri);

// Sử dụng Gemini để tìm một tác phẩm văn học Việt Nam phù hợp nhất với chủ đề
exports.findBestLiteraryWork = async (topic) => {
  try {
    // Tạo prompt để Gemini tìm tác phẩm phù hợp nhất
    const prompt = `Dựa trên chủ đề "${topic}", hãy chọn MỘT tác phẩm văn học Việt Nam phù hợp nhất.
    Nếu chủ đề nhập vào là một tác phẩm cụ thể, trả về tác phẩm đó.
    Nếu chủ đề quá rộng, hãy chọn tác phẩm nổi bật nhất liên quan đến chủ đề này.
    
    Chỉ trả về tên của tác phẩm đó và không thêm bất kỳ thông tin nào khác.
    Ví dụ: "Chí Phèo" hoặc "Truyện Kiều"`;

    // Gọi Gemini API để tìm tác phẩm
    const response = await geminiService.generateScript(prompt);

    // Xử lý kết quả - trích xuất tên tác phẩm từ phản hồi
    // Loại bỏ các dấu ngoặc kép, dấu trích dẫn và các ký tự đặc biệt
    const workTitle = response.replace(/["'""]/g, "").trim();

    // Kiểm tra tác phẩm trong database
    const existingWork = await findWorkInDB(workTitle);

    return {
      title: workTitle,
      inDatabase: !!existingWork,
      ...(existingWork && {
        _id: existingWork._id,
        introduction: existingWork.introduction
          ? existingWork.introduction.substring(0, 200) + "..."
          : "",
      }),
    };
  } catch (error) {
    console.error("Lỗi khi tìm tác phẩm văn học:", error);
    throw new Error("Không thể tìm tác phẩm văn học liên quan đến chủ đề này");
  }
};

// Sử dụng Gemini để tìm tác phẩm văn học liên quan đến chủ đề
exports.findLiteraryWorks = async (topic) => {
  try {
    // Tạo prompt để Gemini tìm tác phẩm liên quan
    const prompt = `Hãy liệt kê 5 tác phẩm văn học liên quan đến chủ đề "${topic}". 
    Với mỗi tác phẩm, hãy cung cấp:
    1. Tên tác phẩm
    2. Tác giả (nếu biết)
    3. Mô tả ngắn về tác phẩm (tối đa 2 câu)
    
    Format kết quả theo JSON như sau:
    [
      {
        "title": "Tên tác phẩm",
        "author": "Tên tác giả",
        "description": "Mô tả ngắn về tác phẩm"
      },
      ...
    ]`;

    // Gọi Gemini API để tìm tác phẩm
    const response = await geminiService.generateScript(prompt);

    // Xử lý kết quả và chuyển sang đối tượng JSON
    // Tìm khối JSON trong văn bản (xử lý trường hợp Gemini trả về văn bản thô)
    const jsonMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    let works = [];

    if (jsonMatch) {
      try {
        works = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("Không thể parse JSON từ Gemini:", e);
        // Fallback nếu không parse được JSON
        works = extractWorksFromText(response);
      }
    } else {
      // Fallback nếu không tìm thấy định dạng JSON
      works = extractWorksFromText(response);
    }

    // Kiểm tra mỗi tác phẩm trong database
    for (let i = 0; i < works.length; i++) {
      const result = await findWorkInDB(works[i].title);
      if (result) {
        works[i].inDatabase = true;
        works[i]._id = result._id;
        works[i].introduction = result.introduction
          ? result.introduction.substring(0, 200) + "..."
          : "";
      } else {
        works[i].inDatabase = false;
      }
    }

    return works;
  } catch (error) {
    console.error("Lỗi khi tìm tác phẩm văn học:", error);
    throw new Error("Không thể tìm tác phẩm văn học liên quan đến chủ đề này");
  }
};

// Hàm trích xuất thông tin tác phẩm từ văn bản thô
function extractWorksFromText(text) {
  const works = [];
  const lines = text.split("\n");

  let currentWork = {};

  for (const line of lines) {
    if (
      line.includes("title") ||
      line.includes("Tên tác phẩm") ||
      line.match(/^\d+\.\s+/)
    ) {
      // Nếu là một tác phẩm mới
      if (currentWork.title) {
        works.push(currentWork);
        currentWork = {};
      }

      // Trích xuất tên tác phẩm
      const titleMatch = line.match(
        /[""]([^""]+)[""]|[:：]\s*(.+)$|^\d+\.\s+(.+)$/
      );
      if (titleMatch) {
        currentWork.title = (
          titleMatch[1] ||
          titleMatch[2] ||
          titleMatch[3]
        ).trim();
      }
    } else if (line.includes("author") || line.includes("Tác giả")) {
      const authorMatch = line.match(/[""]([^""]+)[""]|[:：]\s*(.+)$/);
      if (authorMatch) {
        currentWork.author = (authorMatch[1] || authorMatch[2]).trim();
      }
    } else if (line.includes("description") || line.includes("Mô tả")) {
      const descMatch = line.match(/[""]([^""]+)[""]|[:：]\s*(.+)$/);
      if (descMatch) {
        currentWork.description = (descMatch[1] || descMatch[2]).trim();
      }
    }
  }

  // Thêm tác phẩm cuối cùng nếu có
  if (currentWork.title) {
    works.push(currentWork);
  }

  return works;
}

// Tìm tác phẩm trong database
async function findWorkInDB(title) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const worksCollection = db.collection("works");

    const work = await worksCollection.findOne({
      title: { $regex: new RegExp(`^${title}$`, "i") },
    });

    return work;
  } catch (error) {
    console.error("Lỗi khi tìm trong database:", error);
    return null;
  } finally {
    await client.close();
  }
}

// Tìm tác phẩm trong DB hoặc tìm từ Wikipedia
exports.findOrFetchWork = async (title, author) => {
  try {
    // Kiểm tra xem bài viết đã tồn tại trong DB chưa
    await client.connect();
    const db = client.db(dbName);
    const worksCollection = db.collection("works");

    const existingWork = await worksCollection.findOne({
      title: { $regex: new RegExp(`^${title}$`, "i") },
    });

    if (existingWork) {
      return {
        inDatabase: true,
        work: existingWork,
      };
    }

    // Nếu không có trong DB, tìm trên Wikipedia
    const searchResponse = await axios.get(API_URL, {
      params: {
        action: "query",
        format: "json",
        list: "search",
        srsearch: `${title} ${author || ""}`,
        utf8: 1,
        srlimit: 5,
      },
    });

    if (
      !searchResponse.data.query.search ||
      searchResponse.data.query.search.length === 0
    ) {
      return {
        inDatabase: false,
        inWikipedia: false,
        message: "Không tìm thấy tác phẩm này",
      };
    }

    // Trả về kết quả tìm kiếm từ Wikipedia
    const wikiResults = searchResponse.data.query.search.map((item) => ({
      title: item.title,
      snippet: item.snippet.replace(/<\/?span[^>]*>/g, ""),
      pageid: item.pageid,
    }));

    return {
      inDatabase: false,
      inWikipedia: true,
      wikiResults,
    };
  } catch (error) {
    console.error("Lỗi khi tìm hoặc lấy tác phẩm:", error);
    throw new Error("Không thể kiểm tra tác phẩm");
  } finally {
    await client.close();
  }
};

// Tìm kiếm các bài viết Wikipedia liên quan đến chủ đề
exports.searchWikipedia = async (query) => {
  try {
    // Trước tiên tìm các bài viết liên quan
    const searchResponse = await axios.get(API_URL, {
      params: {
        action: "query",
        format: "json",
        list: "search",
        srsearch: `${query} văn học`,
        utf8: 1,
        srlimit: 5,
      },
    });

    if (
      !searchResponse.data.query.search ||
      searchResponse.data.query.search.length === 0
    ) {
      return { success: false, message: "Không tìm thấy thông tin liên quan" };
    }

    // Lấy danh sách kết quả tìm kiếm
    return {
      success: true,
      results: searchResponse.data.query.search.map((item) => ({
        title: item.title,
        snippet: item.snippet.replace(/<\/?span[^>]*>/g, ""),
        pageid: item.pageid,
      })),
    };
  } catch (error) {
    console.error("Lỗi khi tìm kiếm Wikipedia:", error);
    throw new Error("Không thể tìm kiếm thông tin từ Wikipedia");
  }
};

// Lấy nội dung đầy đủ của một bài viết từ Wikipedia và lưu vào DB
exports.fetchAndSaveArticle = async (pageId, title) => {
  try {
    // Kiểm tra xem bài viết đã tồn tại trong DB chưa
    await client.connect();
    const db = client.db(dbName);
    const worksCollection = db.collection("works");

    // Tìm theo pageId nếu có
    let existingWork = null;
    if (pageId) {
      existingWork = await worksCollection.findOne({ pageid: Number(pageId) });
    }

    // Nếu không tìm thấy theo pageId, tìm theo title
    if (!existingWork && title) {
      existingWork = await worksCollection.findOne({
        title: { $regex: new RegExp(`^${title}$`, "i") },
      });
    }

    if (existingWork) {
      return {
        success: true,
        workId: existingWork._id,
        title: existingWork.title,
        fromCache: true,
      };
    }

    // Nếu chưa có, lấy từ Wikipedia
    const params = pageId ? { pageids: pageId } : { titles: title };

    const response = await axios.get(API_URL, {
      params: {
        action: "query",
        format: "json",
        prop: "extracts",
        explaintext: true,
        ...params,
      },
    });

    const pages = response.data.query.pages;
    const pageKey = Object.keys(pages)[0];

    if (pageKey === "-1") {
      return {
        success: false,
        message: `Không tìm thấy tác phẩm ${title || pageId}`,
      };
    }

    const pageData = {
      pageid: pages[pageKey].pageid,
      title: pages[pageKey].title,
      text: pages[pageKey].extract,
    };

    // Chuẩn hóa dữ liệu
    const text = pageData.text.trim();
    const cleanText = text.replace(/\r\n/g, "\n");
    const parts = cleanText.split(/\n==\s*(.+?)\s*==\n/);
    const introduction = parts[0].trim();
    const sections = [];

    for (let i = 1; i < parts.length; i += 2) {
      const heading = parts[i].trim();
      const content = parts[i + 1] ? parts[i + 1].trim() : "";
      sections.push({ heading, content });
    }

    // Lưu vào database
    const workDoc = {
      pageid: pageData.pageid,
      title: pageData.title,
      introduction,
      metadata: {
        source: "vi.wikipedia.org",
        dynamicallyAdded: true,
        addedAt: new Date(),
      },
      createdAt: new Date(),
    };

    const workResult = await worksCollection.insertOne(workDoc);
    const workId = workResult.insertedId;

    if (sections.length > 0) {
      const sectionsCollection = db.collection("sections");
      const sectionDocs = sections.map((sec) => ({
        workId,
        heading: sec.heading,
        content: sec.content,
        createdAt: new Date(),
      }));
      await sectionsCollection.insertMany(sectionDocs);
    }

    return {
      success: true,
      workId,
      title: pageData.title,
      fromCache: false,
    };
  } catch (error) {
    console.error("Lỗi khi lấy và lưu bài viết:", error);
    throw new Error("Không thể lấy thông tin từ Wikipedia");
  } finally {
    await client.close();
  }
};


// Phê duyệt kịch bản
exports.approveScript = async (scriptId) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    const result = await scriptsCollection.updateOne(
      { _id: new ObjectId(scriptId) },
      {
        $set: {
          status: "approved",
          approvedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new Error("Không tìm thấy kịch bản");
    }

    return {
      success: true,
      scriptId,
    };
  } catch (error) {
    console.error("Error in approveScript:", error);
    throw error;
  } finally {
    await client.close();
  }
};



// Lấy danh sách kịch bản của người dùng
exports.getUserScripts = async (limit = 10) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    const scripts = await scriptsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return scripts;
  } catch (error) {
    console.error("Error in getUserScripts:", error);
    throw error;
  } finally {
    await client.close();
  }
};
