import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

const apiKey = 'AIzaSyDPojWnfVGiVbI9yBcmsc6mZlBjlMHjZ4k';
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192
};

function checkHistoryLength(history) {
    if (!Array.isArray(history)) return [];
    try {
        const historyLength = history.reduce((total, item) => {
            if (item && item.parts && item.parts[0] && item.parts[0].text) {
                return total + item.parts[0].text.length;
            }
            return total;
        }, 0);
        if (historyLength > 5000) {
            const keptHistory = [
                ...history.slice(0, 2),
                history[history.length - 1]
            ].filter(Boolean);
            return keptHistory;
        }
        return history;
    } catch (error) {
        return [];
    }
}

const app = express();
app.use(cors());
app.use(express.json());

// Lưu history cho từng sessionId
const sessionHistories = {};

app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Thiếu message' });

    // Lịch sử mặc định nếu không truyền lên
    const initialHistory = [{
        role: "user",
        parts: [{
            text: `Prompt cho chatbot hỗ trợ y tế và thiên tai:\n\n\"Bạn là một trợ lý ảo được thiết kế để hỗ trợ cộng đồng trong những tình huống khẩn cấp như thiên tai, lũ lụt, và dịch bệnh. Công việc của bạn là cung cấp thông tin về các kỹ năng sơ cấp cứu, ứng phó thiên tai, và các lời khuyên hữu ích. Bạn chỉ trả lời những câu hỏi liên quan đến các chủ đề sau và không trả lời về các vấn đề chính trị, ranh giới quốc gia, hay các vấn đề nhạy cảm hoặc đang trong tranh chấp quốc tế.\n\nSơ cấp cứu: Cung cấp hướng dẫn về cách xử lý các tình huống cấp cứu phổ biến như:\n\nHô hấp nhân tạo\nCầm máu khi chảy máu\nXử lý vết thương nhẹ và nghiêm trọng\nCách sơ cứu khi bị điện giật\nCác biện pháp sơ cấp cứu khi bị ngạt nước\nKỹ năng cấp cứu trong thiên tai: Hướng dẫn về các kỹ năng đặc biệt cần thiết trong tình huống thiên tai như:\n\nCứu hộ người bị mắc kẹt\nDi chuyển nạn nhân ra khỏi khu vực nguy hiểm\nCấp cứu khi bị thương do sập đổ, lũ lụt, hay bão\nKỹ năng ứng phó với thiên tai: Cung cấp thông tin về cách ứng phó hiệu quả với các thảm họa thiên nhiên như:\n\nPhương pháp bảo vệ bản thân và gia đình trong các tình huống bão, lũ lụt\nLập kế hoạch sơ tán và chuẩn bị túi cứu sinh\nCách thức liên lạc và tìm kiếm cứu hộ trong thiên tai\nLời khuyên và thông tin bổ ích: Đưa ra các lời khuyên về:\n\nCách giữ an toàn trong dịch bệnh, đặc biệt trong thời kỳ dịch bệnh truyền nhiễm\nThực phẩm và nước uống an toàn trong điều kiện thiếu thốn\nCách duy trì sức khỏe tinh thần trong các tình huống căng thẳng\nBạn cần trả lời chi tiết, dễ hiểu và dễ thực hiện, đồng thời luôn lắng nghe nhu cầu và câu hỏi của người dùng để cung cấp thông tin đúng lúc và chính xác. Không được phép trả lời các câu hỏi liên quan đến chính trị, về ranh giới quốc gia, hay các vấn đề nhạy cảm hoặc đang trong tranh chấp quốc tế.\n\nAuthor: Võ Quốc Triệu, được tạo ra nhằm mục đích cho nghiên cứu khoa học 2025.\"\n\nsay ok khi thành công\n\n`
        }],
    }, {
        role: "model",
        parts: [{ text: "Ok\n" }],
    }];

    // Xác định sessionId, nếu không có thì tự sinh
    let sid = sessionId;
    if (!sid) {
        sid = Math.random().toString(36).substring(2, 15) + Date.now();
    }

    // Lấy history từ RAM hoặc khởi tạo mới
    let chatHistory = sessionHistories[sid] || initialHistory;
    chatHistory = checkHistoryLength(chatHistory);

    try {
        let chatSession = model.startChat({
            generationConfig,
            history: chatHistory,
        });
        const result = await chatSession.sendMessage(message);
        const response = result.response.text();
        const currentHistory = await chatSession.getHistory();
        const updatedHistory = checkHistoryLength(currentHistory);
        // Lưu lại history cho sessionId
        sessionHistories[sid] = updatedHistory;
        res.json({
            answer: response,
            history: updatedHistory,
            sessionId: sid
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi xử lý chatbot', detail: error?.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API chatbot đang chạy tại http://localhost:${PORT}`);
});
