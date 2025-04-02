const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MongoClient, ObjectId } = require("mongodb"); // Thêm ObjectId vào đây

const GEMINI_API_KEY = "AIzaSyDsZk60rT2odfZ2CIPNhxylxuLKMR9Vj7g";
const uri =
  "mongodb+srv://duongngo1616:vzYfPnMrEB3yF6Qy@literature.s3u8i.mongodb.net/literature_db?retryWrites=true&w=majority";
const dbName = "literature_db";
const client = new MongoClient(uri);

exports.generateScript = async (prompt) => {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    // Kiểm tra nếu result.response.text là một hàm thì gọi nó để lấy chuỗi
    const text =
      typeof result.response.text === "function"
        ? result.response.text()
        : result.response.text;
    const scriptText = text.trim();
    return scriptText;
  } catch (error) {
    console.error("Gemini API Error:", error.response?.data || error.message);
    throw new Error("Không thể tạo kịch bản từ Gemini API");
  }
};

// Thêm hàm mới để kiểm tra và cập nhật script
exports.upsertScript = async (workId, scriptContent) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("scripts");

    // Chuyển đổi workId thành ObjectId nếu nó là string
    const workObjectId =
      typeof workId === "string" ? new ObjectId(workId) : workId;

    // Tìm script hiện có cho tác phẩm này
    const existingScript = await scriptsCollection.findOne({
      workId: workObjectId,
    });

    if (existingScript) {
      // Nếu đã tồn tại, cập nhật script
      await scriptsCollection.updateOne(
        { workId: workObjectId },
        {
          $set: {
            content: scriptContent,
            updatedAt: new Date(),
          },
        }
      );
      console.log(`Đã cập nhật script cho tác phẩm ID: ${workId}`);
      return { updated: true, scriptId: existingScript._id };
    } else {
      // Nếu chưa tồn tại, tạo mới script
      const result = await scriptsCollection.insertOne({
        workId: workObjectId, // Dùng ObjectId
        content: scriptContent,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`Đã tạo script mới cho tác phẩm ID: ${workId}`);
      return { updated: false, scriptId: result.insertedId };
    }
  } catch (error) {
    console.error("Lỗi khi thao tác với database:", error);
    throw new Error("Không thể cập nhật hoặc tạo script");
  } finally {
    await client.close();
  }
};

// Lấy thông tin kịch bản dựa theo ID
exports.getScriptById = async (scriptId) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    const script = await scriptsCollection.findOne({
      _id: new ObjectId(scriptId),
    });

    if (!script) {
      throw new Error("Không tìm thấy kịch bản");
    }

    return script;
  } catch (error) {
    console.error("Error in getScriptById:", error);
    throw error;
  } finally {
    await client.close();
  }
};

// Cập nhật nội dung kịch bản
exports.updateScript = async (scriptId, content, status, adjustmentMode) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");

    const updateData = {
      updatedAt: new Date(),
    };

    if (content) updateData.content = content;
    if (status) updateData.status = status;
    if (adjustmentMode) updateData.adjustmentMode = adjustmentMode;

    const result = await scriptsCollection.updateOne(
      { _id: new ObjectId(scriptId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      throw new Error("Không tìm thấy kịch bản");
    }

    return {
      success: true,
      scriptId,
      updated: true,
    };
  } catch (error) {
    console.error("Error in updateScript:", error);
    throw error;
  } finally {
    await client.close();
  }
};

// Tạo phiên bản kịch bản tự động điều chỉnh
exports.autoAdjustScript = async (scriptId, adjustment) => {
  try {
    // Lấy kịch bản hiện tại
    const script = await this.getScriptById(scriptId);

    // Tạo prompt để điều chỉnh nội dung
    const prompt = `Hãy điều chỉnh kịch bản video văn học sau theo yêu cầu: "${adjustment}".
    
Kịch bản hiện tại:
${script.content}

Lưu ý: dựa vào yêu cầu và tạo thành một kịch bản mới.`;

    // Gọi Gemini API để điều chỉnh kịch bản
    const adjustedContent = await this.generateScript(prompt);

    // Cập nhật kịch bản với nội dung mới
    return await this.updateScript(
      scriptId,
      adjustedContent,
      "adjusted",
      "auto"
    );
  } catch (error) {
    console.error("Error in autoAdjustScript:", error);
    throw error;
  }
};

exports.getImageScript = async (scriptId) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const scriptsCollection = db.collection("topic_scripts");
    const script = await scriptsCollection.findOne({
      _id: new ObjectId(scriptId),
    });

    if (!script) {
      throw new Error("Không tìm thấy kịch bản");
    }

    const content = script.content;

    // Enhanced prompt to extract image descriptions from various formats
    const prompt = `Nhiệm vụ: Trích xuất TẤT CẢ những mô tả về hình ảnh từ kịch bản phim dưới đây.

Hãy tìm kiếm và trích xuất các phần mô tả hình ảnh theo các định dạng sau:
1. Các dòng có cú pháp "**(Hình ảnh:** <mô tả>)"
2. Các dòng bắt đầu với "**Hình ảnh:**" hoặc "Hình ảnh:"
3. Các mục có dấu bullet (*) và chứa mô tả hình ảnh
4. Phần "Hình ảnh:" trong phần giới thiệu hoặc mô tả chung
5. Bất kỳ đoạn văn nào mô tả các cảnh quay, bối cảnh trực quan, cảnh trí

Định dạng kết quả:
- Liệt kê từng mô tả hình ảnh trên một dòng mới
- Mỗi mô tả bắt đầu bằng dấu "-"
- Loại bỏ các ký hiệu đánh dấu như *, ** hoặc (Hình ảnh:) khỏi nội dung
- Chỉ giữ lại phần mô tả hình ảnh, bỏ qua các chỉ dẫn về âm thanh, giọng đọc, hoặc ghi chú kỹ thuật
- Giữ các chi tiết quan trọng về bối cảnh, nhân vật và cảm xúc trong hình ảnh

Kịch bản:
${content}`;

    // Call Gemini API to extract image descriptions
    const imageContent = await this.generateScript(prompt);

    return imageContent;
  } catch (error) {
    console.error("Error in getImageScript:", error);
    throw error;
  } finally {
    await client.close();
  }
};
