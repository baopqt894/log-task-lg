'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function HelpPage() {
  const [openFaqs, setOpenFaqs] = useState<number[]>([]);

  const faqs = [
    {
      question: 'Làm cách nào để tạo một tác vụ mới?',
      answer:
        'Truy cập "Bảng Công Việc" và nhấp vào nút "Tạo Tác Vụ". Điền các thông tin cần thiết như tên, mô tả, dự án và những chi tiết khác.',
    },
    {
      question: 'Làm cách nào để gán tác vụ cho một thành viên?',
      answer:
        'Khi tạo hoặc chỉnh sửa tác vụ, hãy chọn thành viên trong trường "Thành viên". Thành viên sẽ nhận được thông báo về tác vụ được gán.',
    },
    {
      question: 'Tôi có thể thay đổi trạng thái tác vụ như thế nào?',
      answer:
        'Bạn có thể nhấp vào thẻ tác vụ và chọn trạng thái mới: "Chưa bắt đầu", "Đang thực hiện" hoặc "Hoàn thành".',
    },
    {
      question: 'Làm cách nào để tạo một dự án mới?',
      answer:
        'Đi đến "Dự Án" từ menu bên và nhấp vào "Tạo Dự Án". Nhập tên và mô tả dự án.',
    },
    {
      question: 'Tôi có thể xem báo cáo và thống kê không?',
      answer:
        'Có, tính năng "Báo Cáo" sẽ cung cấp các thống kê chi tiết về tiến độ dự án và hiệu suất của đội ngũ.',
    },
  ];

  const toggleFaq = (index: number) => {
    if (openFaqs.includes(index)) {
      setOpenFaqs(openFaqs.filter((i) => i !== index));
    } else {
      setOpenFaqs([...openFaqs, index]);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Trợ Giúp</h1>
        <p className="text-slate-600 mt-1">
          Tìm câu trả lời cho những câu hỏi thường gặp
        </p>
      </div>

      {/* FAQs */}
      <div className="space-y-3">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-slate-200 overflow-hidden"
          >
            <button
              onClick={() => toggleFaq(index)}
              className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
            >
              <h3 className="font-semibold text-slate-900 text-left">
                {faq.question}
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-slate-600 transition-transform ${
                  openFaqs.includes(index) ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openFaqs.includes(index) && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <p className="text-slate-600">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact Support */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h2 className="text-lg font-bold text-blue-900 mb-2">
          Không tìm thấy câu trả lời?
        </h2>
        <p className="text-blue-800 mb-4">
          Liên hệ với đội hỗ trợ của chúng tôi để được giúp đỡ
        </p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Gửi Tin Nhắn Hỗ Trợ
        </button>
      </div>
    </div>
  );
}
