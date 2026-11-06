/* Copy for the landing page. Describes only what the app really does; keep the "indicative, not CFD" framing. */
import type { SiteLang } from './site';

type L = Record<SiteLang, string>;

export const landingPath = (lang: SiteLang): string => (lang === 'vi' ? '/vi' : '/');

export const LANDING: {
  nav: Record<'features' | 'how' | 'guide' | 'faq' | 'open' | 'switchTo', L>;
  hero: Record<'pill' | 'h1a' | 'h1b' | 'lead' | 'primary' | 'secondary' | 'note' | 'liveLabel' | 'wind' | 'pause' | 'play', L>;
  stats: { v: string; k: L }[];
  featuresH: L;
  features: { h: L; p: L }[];
  stepsH: L;
  steps: { h: L; p: L }[];
  honestH: L;
  honestP: L;
  honestLink: L;
  ctaH: L;
  ctaP: L;
  footer: Record<'note' | 'source', L>;
} = {
  nav: {
    features: { en: 'Features', vi: 'Tính năng' },
    how: { en: 'How it works', vi: 'Cách hoạt động' },
    guide: { en: 'Guide', vi: 'Hướng dẫn' },
    faq: { en: 'FAQ', vi: 'Hỏi đáp' },
    open: { en: 'Open the app', vi: 'Mở ứng dụng' },
    switchTo: { en: 'Tiếng Việt', vi: 'English' }
  },
  hero: {
    pill: { en: 'Free in your browser · Nothing is uploaded', vi: 'Miễn phí trên trình duyệt · Không tải dữ liệu lên' },
    h1a: { en: 'See how wind moves', vi: 'Xem gió đi qua' },
    h1b: { en: 'through your floor plan.', vi: 'mặt bằng của bạn.' },
    lead: {
      en: 'Draw walls, windows and fans, set the wind, and watch air flow through every room. Compare two layouts in minutes, not hours.',
      vi: 'Vẽ tường, cửa sổ và quạt, đặt hướng gió rồi xem không khí chảy qua từng phòng. So sánh hai phương án bố trí trong vài phút.'
    },
    primary: { en: 'Start drawing', vi: 'Bắt đầu vẽ' },
    secondary: { en: 'Read the guide', vi: 'Đọc hướng dẫn' },
    note: { en: 'Indicative 2D teaching model, not CFD.', vi: 'Mô hình 2D mang tính tham khảo, không phải CFD.' },
    liveLabel: { en: 'Live simulation of a cross-ventilated studio', vi: 'Mô phỏng trực tiếp một căn studio thông gió xuyên phòng' },
    wind: { en: 'Wind from the west · 2 m/s', vi: 'Gió từ hướng tây · 2 m/s' },
    pause: { en: 'Pause', vi: 'Tạm dừng' },
    play: { en: 'Play', vi: 'Chạy' }
  },
  stats: [
    { v: '18', k: { en: 'example plans and sections', vi: 'mặt bằng và mặt cắt mẫu' } },
    { v: '16', k: { en: 'wind directions in one sweep', vi: 'hướng gió trong một lần quét' } },
    { v: '2', k: { en: 'languages: English and Vietnamese', vi: 'ngôn ngữ: tiếng Anh và tiếng Việt' } },
    { v: '0', k: { en: 'sign-ups, installs or uploads', vi: 'đăng ký, cài đặt hay tải lên' } }
  ],
  featuresH: { en: 'Everything you need to read the air in a plan', vi: 'Mọi thứ để đọc luồng gió trong mặt bằng' },
  features: [
    {
      h: { en: 'Draw in seconds', vi: 'Vẽ trong vài giây' },
      p: {
        en: 'Walls, doors, windows, fans, heaters and porous screens, with undo and keyboard shortcuts. Plan or section view.',
        vi: 'Tường, cửa đi, cửa sổ, quạt, nguồn nhiệt và vách thoáng, có hoàn tác và phím tắt. Xem theo mặt bằng hoặc mặt cắt.'
      }
    },
    {
      h: { en: 'Room-by-room numbers', vi: 'Số liệu từng phòng' },
      p: {
        en: 'Fresh-air share, air speed, dead zones and air age for every room, written in plain language.',
        vi: 'Tỉ lệ khí tươi, tốc độ gió, vùng khí đứng và tuổi không khí của từng phòng, diễn giải dễ hiểu.'
      }
    },
    {
      h: { en: 'Sweep every wind direction', vi: 'Quét mọi hướng gió' },
      p: {
        en: 'Test a layout against 8 or 16 directions and see on a wind rose which ones help and which ones hurt.',
        vi: 'Thử một bố cục với 8 hoặc 16 hướng gió và xem trên hoa gió hướng nào có lợi, hướng nào bất lợi.'
      }
    },
    {
      h: { en: 'Compare layouts side by side', vi: 'So sánh các phương án cạnh nhau' },
      p: {
        en: 'Keep up to eight boards on one canvas, each with its own wind. Add notes and arrows around them.',
        vi: 'Giữ tới tám bảng trên một vùng vẽ, mỗi bảng có gió riêng. Thêm ghi chú và mũi tên xung quanh.'
      }
    },
    {
      h: { en: 'Feng shui, measured as airflow', vi: 'Phong thủy, đo bằng luồng gió' },
      p: {
        en: 'Four tradition-based rules checked as airflow on your plan, shown next to the physics. Tradition, not engineering.',
        vi: 'Bốn quy tắc truyền thống được kiểm tra dưới dạng luồng gió trên mặt bằng, đặt cạnh phần vật lý. Truyền thống, không phải kỹ thuật.'
      }
    },
    {
      h: { en: 'Share and export', vi: 'Chia sẻ và xuất file' },
      p: {
        en: 'Copy a link that carries the whole project, or record the simulation as an animated GIF.',
        vi: 'Sao chép liên kết chứa cả dự án, hoặc ghi lại mô phỏng thành ảnh GIF động.'
      }
    }
  ],
  stepsH: { en: 'From sketch to insight in three steps', vi: 'Từ phác thảo đến hiểu biết trong ba bước' },
  steps: [
    {
      h: { en: 'Draw the plan', vi: 'Vẽ mặt bằng' },
      p: {
        en: 'Start from one of 18 examples or a blank board and place walls and openings.',
        vi: 'Bắt đầu từ một trong 18 ví dụ hoặc bảng trống rồi đặt tường và ô mở.'
      }
    },
    {
      h: { en: 'Set the wind', vi: 'Đặt hướng gió' },
      p: { en: 'Pick a direction and speed, or a typical wind preset, and press run.', vi: 'Chọn hướng và tốc độ, hoặc một mẫu gió thường gặp, rồi nhấn chạy.' }
    },
    {
      h: { en: 'Read the air', vi: 'Đọc luồng khí' },
      p: { en: 'Follow the streaks, check each room, and change one thing at a time.', vi: 'Theo dõi các vệt gió, xem từng phòng và mỗi lần chỉ đổi một thứ.' }
    }
  ],
  honestH: { en: 'Honest about what it is', vi: 'Trung thực về những gì nó là' },
  honestP: {
    en: 'Crossdraft is a small, fast 2D solver built for learning and early comparisons. It is indicative, not CFD, and it does not replace a professional ventilation study.',
    vi: 'Crossdraft là bộ giải 2D nhỏ và nhanh, dùng để học và so sánh ở giai đoạn đầu. Kết quả mang tính tham khảo, không phải CFD, và không thay thế nghiên cứu thông gió chuyên nghiệp.'
  },
  honestLink: { en: 'How the simulation works', vi: 'Mô phỏng hoạt động thế nào' },
  ctaH: { en: 'Open a plan and watch it breathe.', vi: 'Mở một mặt bằng và xem nó thở.' },
  ctaP: { en: 'No account. Your drawings stay in your browser.', vi: 'Không cần tài khoản. Bản vẽ ở lại trong trình duyệt của bạn.' },
  footer: {
    note: { en: 'Crossdraft is a free, open-source airflow sketchpad.', vi: 'Crossdraft là bảng phác thảo luồng gió mã nguồn mở, miễn phí.' },
    source: { en: 'Source on GitHub', vi: 'Mã nguồn trên GitHub' }
  }
};
