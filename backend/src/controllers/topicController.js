const { MongoClient, ObjectId } = require("mongodb");
const geminiService = require("../services/geminiService");
const literatureService = require("../services/literatureService");

const uri =
  "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/literature_db?retryWrites=true&w=majority";
const dbName = "literature_db";
const client = new MongoClient(uri);

// Danh sách chủ đề gợi ý cố định
const SUGGESTED_TOPICS = [
  "Văn học trung đại Việt Nam",
  "Truyện ngắn Nam Cao",
  "Người lính chiến sĩ",
  "Tình cảm gia đình",
  "Thơ việt nam sau thời kỳ đổi mới",
  "Tình cảm vợ chồng",
];

// Danh sách phong cách viết
const CONTENT_STYLES = [
  { id: "analysis", name: "Phân tích văn học" },
  { id: "storytelling", name: "Kể chuyện" },
  { id: "poetry", name: "Minh họa thơ ca" },
];

// API lấy danh sách gợi ý
exports.getSuggestions = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      topics: SUGGESTED_TOPICS,
      styles: CONTENT_STYLES,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// API tìm kiếm tác phẩm dựa trên chủ đề từ người dùng
exports.findWorks = async (req, res) => {
  try {
    const { topic } = req.query;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập chủ đề cần tìm",
      });
    }

    // Sử dụng Gemini API để tìm tác phẩm phù hợp nhất
    const work = await literatureService.findBestLiteraryWork(topic);

    // Nếu không tìm thấy trong DB, kiểm tra và lấy từ Wikipedia
    if (!work.inDatabase) {
      const wikiResult = await literatureService.findOrFetchWork(work.title);

      // Nếu có trên Wikipedia, lấy dữ liệu
      if (
        wikiResult.inWikipedia &&
        wikiResult.wikiResults &&
        wikiResult.wikiResults.length > 0
      ) {
        const firstResult = wikiResult.wikiResults[0];
        // Lấy và lưu thông tin từ Wikipedia
        const savedResult = await literatureService.fetchAndSaveArticle(
          firstResult.pageid,
          firstResult.title
        );

        if (savedResult.success) {
          work.title = savedResult.title;
          work._id = savedResult.workId;
          work.inDatabase = true;
          work.fromWikipedia = true;
        }
      }
    }

    res.status(200).json({
      success: true,
      topic,
      work,
    });
  } catch (error) {
    console.error("Error in findWorks:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// API kiểm tra tác phẩm trong DB/Wikipedia
exports.checkWork = async (req, res) => {
  try {
    const { title, author } = req.query;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp tên tác phẩm",
      });
    }

    const result = await literatureService.findOrFetchWork(title, author);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in checkWork:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// API lấy và lưu bài viết Wikipedia
exports.fetchArticle = async (req, res) => {
  try {
    const { pageId, title } = req.body;

    if (!pageId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp pageId",
      });
    }

    const result = await literatureService.fetchAndSaveArticle(pageId, title);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in fetchArticle:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// API tạo kịch bản cho chủ đề được nhập
exports.generateScriptByTopic = async (req, res) => {
  try {
    const { topic, style, isManualMode, contentParams } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp chủ đề",
      });
    }

    // Phong cách mặc định
    const contentStyle = style || "analysis";

    // 1. Tìm tác phẩm phù hợp nhất với chủ đề
    const work = await literatureService.findBestLiteraryWork(topic);

    // 2. Nếu tác phẩm không có trong DB, tìm và lấy từ Wikipedia
    let workData;
    let workId;

    if (work.inDatabase && work._id) {
      // Nếu đã có trong DB, lấy thông tin
      await client.connect();
      const db = client.db(dbName);
      const worksCollection = db.collection("works");

      workData = await worksCollection.findOne({ _id: new ObjectId(work._id) });
      workId = work._id;
      await client.close();
    } else {
      // Tìm trên Wikipedia và lưu vào DB
      const wikiResult = await literatureService.findOrFetchWork(work.title);

      if (
        wikiResult.inWikipedia &&
        wikiResult.wikiResults &&
        wikiResult.wikiResults.length > 0
      ) {
        const firstResult = wikiResult.wikiResults[0];
        const savedWork = await literatureService.fetchAndSaveArticle(
          firstResult.pageid,
          firstResult.title
        );

        if (savedWork.success) {
          await client.connect();
          const db = client.db(dbName);
          const worksCollection = db.collection("works");

          workData = await worksCollection.findOne({
            _id: new ObjectId(savedWork.workId),
          });
          workId = savedWork.workId;
          await client.close();
        }
      }
    }

    if (!workData) {
      return res.status(404).json({
        success: false,
        message: "Không thể tìm thấy thông tin về tác phẩm phù hợp với chủ đề",
      });
    }

    // 3. Tạo prompt dựa trên thông tin tác phẩm và phong cách
    let prompt;
    const worksContent = `Tác phẩm: ${workData.title}\n${workData.introduction}`;

    // Xử lý chế độ thủ công nếu được kích hoạt
    if (isManualMode && contentParams) {
      // Tạo prompt với các tham số tùy chỉnh từ người dùng
      const lengthMap = {
        short: "ngắn (khoảng 500-800 từ)",
        medium: "vừa phải (khoảng 800-1200 từ)",
        long: "dài (khoảng 1200-2000 từ)",
      };

      const toneMap = {
        formal: "học thuật, trang trọng",
        conversational: "đối thoại, dễ hiểu",
        enthusiastic: "nhiệt huyết, cuốn hút",
      };

      const complexityMap = {
        simple: "đơn giản, dễ hiểu cho học sinh",
        medium: "trung bình, phù hợp cho sinh viên",
        complex: "phức tạp, chuyên sâu cho người chuyên ngành",
      };

      const focusElements = contentParams.focusOn
        .map((focus) => {
          switch (focus) {
            case "themes":
              return "chủ đề và thông điệp";
            case "characters":
              return "nhân vật và tính cách";
            case "context":
              return "bối cảnh lịch sử và xã hội";
            case "language":
              return "ngôn ngữ và kỹ thuật viết";
            default:
              return focus;
          }
        })
        .join(", ");

      prompt = `Hãy tạo một kịch bản video văn học về tác phẩm "${
        workData.title
      }" liên quan đến chủ đề "${topic}" với các yêu cầu cụ thể sau:

1. Phong cách: ${
        contentStyle === "analysis"
          ? "phân tích văn học"
          : contentStyle === "storytelling"
          ? "kể chuyện"
          : "minh họa thơ ca"
      }
2. Độ dài: ${lengthMap[contentParams.length]}
3. Giọng điệu: ${toneMap[contentParams.tone]}
4. Độ phức tạp: ${complexityMap[contentParams.complexity]}
5. Tập trung vào: ${focusElements}

Dựa trên thông tin sau về tác phẩm:
${worksContent}

Hãy tạo kịch bản có cấu trúc rõ ràng, hấp dẫn và đáp ứng đúng các yêu cầu về độ dài, giọng điệu và độ phức tạp đã nêu.`;
    } else {
      // Chế độ tự động - sử dụng prompt mặc định dựa trên phong cách
      switch (contentStyle) {
        case "analysis":
          prompt = `Hãy tạo một kịch bản video phân tích văn học về chủ đề "${topic}" thông qua tác phẩm "${workData.title}".
Kịch bản cần có cấu trúc rõ ràng với phần giới thiệu, phân tích chuyên sâu, và kết luận.
Đưa ra các ví dụ cụ thể và phân tích ý nghĩa văn học.
Dựa trên thông tin sau:
${worksContent}`;
          break;

        case "storytelling":
          prompt = `Hãy tạo một kịch bản video kể chuyện hấp dẫn về tác phẩm "${workData.title}" liên quan đến chủ đề "${topic}".
Kịch bản cần có cốt truyện rõ ràng, nhân vật sinh động và giọng kể chuyện cuốn hút.
Dựa trên thông tin sau:
${worksContent}`;
          break;

        case "poetry":
          prompt = `Hãy tạo một kịch bản video minh họa thơ ca về tác phẩm "${workData.title}" liên quan đến chủ đề "${topic}".
Kịch bản cần phân tích ý nghĩa của tác phẩm, và giải thích nghệ thuật trong tác phẩm.
Dựa trên thông tin sau:
${worksContent}`;
          break;

        default:
          prompt = `Hãy tạo một kịch bản video văn học về tác phẩm "${workData.title}" liên quan đến chủ đề "${topic}".
Dựa trên thông tin sau:
${worksContent}`;
      }
    }

    // 4. Gọi Gemini API để tạo kịch bản
    const scriptContent = await geminiService.generateScript(prompt);

    // 5. Trả về kịch bản để preview
    res.status(200).json({
      success: true,
      topic,
      style: contentStyle,
      preview: scriptContent,
      workIds: [workId],
      work: {
        id: workId,
        title: workData.title,
      },
    });
  } catch (error) {
    console.error("Error in generateScriptByTopic:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// API lưu kịch bản sau khi xem preview
exports.saveScript = async (req, res) => {
  try {
    const { topic, style, content, workIds } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Nội dung kịch bản không được để trống",
      });
    }

    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    const result = await scriptsCollection.insertOne({
      topic,
      style: style || "analysis",
      content,
      workIds: workIds || [],
      createdAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Kịch bản đã được lưu",
      scriptId: result.insertedId,
    });
  } catch (error) {
    console.error("Error in saveScript:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await client.close();
  }
};

// API lấy thông tin kịch bản theo ID
exports.getScript = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Script ID is required",
      });
    }

    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    const script = await scriptsCollection.findOne({ _id: new ObjectId(id) });

    if (!script) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy kịch bản",
      });
    }

    res.status(200).json({
      success: true,
      script,
    });
  } catch (error) {
    console.error("Error in getScript:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await client.close();
  }
};

// API cập nhật kịch bản
exports.updateScript = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, status } = req.body;

    if (!id || !content) {
      return res.status(400).json({
        success: false,
        message: "Script ID and content are required",
      });
    }

    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    const updateData = {
      content,
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status;
    }

    const result = await scriptsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy kịch bản",
      });
    }

    res.status(200).json({
      success: true,
      message: "Kịch bản đã được cập nhật",
      scriptId: id,
    });
  } catch (error) {
    console.error("Error in updateScript:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    await client.close();
  }
};

// API phê duyệt kịch bản
exports.approveScript = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp ID kịch bản",
      });
    }

    const result = await scriptService.approveScript(id);

    res.status(200).json({
      success: true,
      message: "Kịch bản đã được phê duyệt",
      scriptId: id,
    });
  } catch (error) {
    console.error("Error in approveScript:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// API tự động điều chỉnh kịch bản
exports.autoAdjustScript = async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Script ID is required",
      });
    }

    if (!adjustment) {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu điều chỉnh là bắt buộc",
      });
    }

    const result = await geminiService.autoAdjustScript(id, adjustment);

    res.status(200).json({
      success: true,
      message: "Kịch bản đã được điều chỉnh tự động",
      scriptId: id,
      content: result.content,
    });
  } catch (error) {
    console.error("Error in autoAdjustScript:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// API lấy danh sách kịch bản của người dùng
exports.getUserScripts = async (req, res) => {
  try {
    const { limit } = req.query;

    const scripts = await scriptService.getUserScripts(
      limit ? parseInt(limit) : 10
    );

    res.status(200).json({
      success: true,
      scripts,
    });
  } catch (error) {
    console.error("Error in getUserScripts:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
