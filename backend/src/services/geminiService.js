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
