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

    // Enhanced prompt to extract image descriptions and corresponding narrator content
    const prompt = `Nhiệm vụ: Trích xuất TẤT CẢ những mô tả về hình ảnh và nội dung thoại tương ứng từ kịch bản phim dưới đây.

Hãy tìm kiếm và trích xuất các phần theo định dạng sau:
1. Với mỗi hình ảnh, trích xuất:
   - Mô tả hình ảnh (tìm theo các cú pháp sau):
     + "**(Hình ảnh):** <mô tả>"
     + "**Hình ảnh:** <mô tả>"
     + "Hình ảnh: <mô tả>"
     + Các mô tả trong phần "Bối cảnh:" hoặc "Nhân vật:"
     + Các mô tả trong dấu ngoặc đơn như "(Bước vào bếp, nhìn ông Kazuo đang chuẩn bị nguyên liệu)"
     + Các mô tả trong dấu ngoặc vuông như "[Mở đầu – Cảnh 1: Căn bếp ấm áp]"
   - Nội dung thoại tương ứng (tìm theo các cú pháp sau):
     + Các đoạn thoại có nhãn nhân vật như "**Nhân vật:** <nội dung>"
     + Các đoạn thoại trong dấu ngoặc đơn như "(Nhìn vào máy quay) Kính chào quý vị"
     + Các đoạn thoại trong dấu ngoặc vuông như "[V.O.]"
     + Các đoạn văn không có nhãn người nói
     + Các đoạn hội thoại liên quan đến hình ảnh

Định dạng kết quả:
- Mỗi cặp hình ảnh và nội dung thoại được đặt trong một khối
- Mỗi khối bắt đầu bằng "---"
- Trong mỗi khối:
  + Dòng đầu tiên bắt đầu bằng "image:" chứa mô tả hình ảnh
  + Dòng thứ hai bắt đầu bằng "dialogue:" chứa nội dung thoại tương ứng
- Loại bỏ các ký hiệu đánh dấu như *, **, (), [], V.O. khỏi nội dung
- Chỉ giữ lại phần mô tả hình ảnh và nội dung thoại, bỏ qua các chỉ dẫn về âm thanh, nhạc nền
- Giữ các chi tiết quan trọng về bối cảnh, nhân vật và cảm xúc.
- Dòng "image": không được để trống, nếu không có mô tả hình ảnh tương ứng thì để lại dòng "image:" trống
- Nếu không tìm thấy nội dung thoại tương ứng, để trống dòng "dialogue:"

Kịch bản:
${content}`;

    // Call Gemini API to extract image descriptions and dialogue content
    const result = await this.generateScript(prompt);

    // Parse the result into an array of objects
    const blocks = result.split('---').filter(block => block.trim());
    const imageDialoguePairs = blocks.map(block => {
      const lines = block.split('\n').filter(line => line.trim());
      const imageLine = lines.find(line => line.startsWith('image:'));
      const dialogueLine = lines.find(line => line.startsWith('dialogue:'));
      
      return {
        image: imageLine ? imageLine.replace('image:', '').trim() : '',
        dialogue: dialogueLine ? dialogueLine.replace('dialogue:', '').trim() : ''
      };
    });

    console.log("Extracted image-dialogue pairs:", imageDialoguePairs);
    return imageDialoguePairs;
  } catch (error) {
    console.error("Error in getImageScript:", error);
    throw error;
  } finally {
    await client.close();
  }
};

exports.extractNarratorContent = async (scriptContent) => {
  try {
    const prompt = `Nhiệm vụ: Trích xuất TẤT CẢ nội dung của người dẫn chuyện từ kịch bản video dưới đây.

Hãy tìm kiếm và trích xuất các phần có cú pháp "**Người dẫn truyện:**" hoặc "**Người dẫn truyện (giọng trang trọng, học thuật):**" và nội dung sau đó.

Định dạng kết quả:
- Mỗi đoạn nội dung người dẫn chuyện trên một dòng mới
- Mỗi đoạn bắt đầu bằng dấu "-"
- Loại bỏ các ký hiệu đánh dấu như ** hoặc (giọng trang trọng, học thuật)
- Chỉ giữ lại phần nội dung người dẫn chuyện, bỏ qua các chỉ dẫn về hình ảnh, nhạc nền
- Giữ nguyên dấu câu và ngắt dòng

Kịch bản:
${scriptContent}`;

    // Call Gemini API to extract narrator content
    const narratorContent = await this.generateScript(prompt);

    return narratorContent;
  } catch (error) {
    console.error("Error in extractNarratorContent:", error);
    throw error;
  }
};
