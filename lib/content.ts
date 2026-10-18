/* Guide pages: real, crawlable text about airflow in plans and about what Crossdraft does and does not do.
   Written for people first. Everything here describes behaviour that exists in the app; nothing is a ranking claim. */
import { translate } from './i18n';
import { PRESETS } from './presets';
import type { SiteLang } from './site';

type L = Record<SiteLang, string>;
type LL = Record<SiteLang, string[]>;
export interface Section {
  h: L;
  p: LL;
  list?: LL;
}
export interface Article {
  slug: string;
  title: L;
  description: L;
  sections: Section[];
}
export interface Faq {
  q: L;
  a: L;
}

export const SLUGS = ['what-is-crossdraft', 'cross-ventilation-basics', 'how-it-works', 'feng-shui-airflow', 'examples', 'faq'] as const;
export type Slug = (typeof SLUGS)[number];

export const ARTICLES: Record<Exclude<Slug, 'examples' | 'faq'>, Article> = {
  'what-is-crossdraft': {
    slug: 'what-is-crossdraft',
    title: { en: 'What is Crossdraft?', vi: 'Crossdraft là gì?' },
    description: {
      en: 'Crossdraft is a free sketchpad that shows how wind moves through a floor plan or section, so architecture and engineering students can compare layouts quickly.',
      vi: 'Crossdraft là bảng phác thảo miễn phí cho thấy gió đi qua mặt bằng hoặc mặt cắt như thế nào, giúp sinh viên kiến trúc và kỹ thuật so sánh nhanh các phương án bố trí.'
    },
    sections: [
      {
        h: { en: 'A sketchpad for air', vi: 'Bảng phác thảo cho luồng khí' },
        p: {
          en: [
            'Crossdraft is a web app where you draw walls, doors, windows, fans and heaters on a board, set the wind, and watch air move through the rooms as animated streaks. It runs entirely in your browser: nothing is uploaded and no account is needed.',
            'It is aimed at architecture and engineering students who want to see why one layout feels airy and another feels stuffy, and at anyone comparing two ways to place a window. It is built for quick questions, not for certification.'
          ],
          vi: [
            'Crossdraft là ứng dụng web để bạn vẽ tường, cửa đi, cửa sổ, quạt và nguồn nhiệt lên một bảng, đặt hướng gió và xem không khí chảy qua các phòng dưới dạng những vệt chuyển động. Ứng dụng chạy hoàn toàn trong trình duyệt: không tải gì lên máy chủ và không cần tài khoản.',
            'Công cụ dành cho sinh viên kiến trúc và kỹ thuật muốn hiểu vì sao bố cục này thoáng còn bố cục kia bí, và cho bất kỳ ai đang so sánh hai cách đặt cửa sổ. Nó phục vụ những câu hỏi nhanh, không dùng để chứng nhận thiết kế.'
          ]
        }
      },
      {
        h: { en: 'What you can do with it', vi: 'Bạn có thể làm gì' },
        p: { en: ['The main things the app offers today:'], vi: ['Những điều ứng dụng làm được hiện nay:'] },
        list: {
          en: [
            'Draw a plan (top-down, wind only) or a section (side view, where heat rises).',
            'Place several boards on one canvas, each with its own drawing and wind direction, to view one building from different wind directions.',
            'Read each room: share of stale air flushed out, dead-zone area, draught comfort, mean air age and the time to reach 90% fresh air.',
            'Compare two designs with a fixed-length test, and sweep the wind through 8 or 16 directions to see how robust a layout is.',
            'Open example layouts, from a simple studio to a terrace of three houses, each with a note on what to look for.',
            'Share a whole project as a link, or record a short GIF of the flow.',
            'Use it in English or Vietnamese.'
          ],
          vi: [
            'Vẽ mặt bằng (nhìn từ trên, chỉ có gió) hoặc mặt cắt (nhìn ngang, khí nóng bay lên).',
            'Đặt nhiều bảng trên một canvas, mỗi bảng có bản vẽ và hướng gió riêng, để xem một công trình với nhiều hướng gió khác nhau.',
            'Đọc kết quả từng phòng: phần không khí tù được thay mới, diện tích vùng lặng gió, độ dễ chịu về gió lùa, tuổi không khí trung bình và thời gian đạt 90% không khí sạch.',
            'So sánh hai phương án bằng bài thử có độ dài cố định, và quét hướng gió qua 8 hoặc 16 hướng để xem bố cục có bền hay không.',
            'Mở các bản vẽ ví dụ, từ studio đơn giản đến dãy ba nhà liền kề, mỗi ví dụ có ghi chú nên để ý điều gì.',
            'Chia sẻ cả dự án bằng một đường dẫn, hoặc ghi một ảnh GIF ngắn về dòng khí.',
            'Dùng bằng tiếng Anh hoặc tiếng Việt.'
          ]
        }
      },
      {
        h: { en: 'What it is not', vi: 'Crossdraft không phải là gì' },
        p: {
          en: [
            'Crossdraft is a two-dimensional teaching model, not computational fluid dynamics (CFD) software and not a compliance tool. It does not model a real site, building height, furniture, or the three-dimensional shape of a room. Use it to build intuition and to compare options, then use proper tools and a qualified engineer for decisions that matter. The page on how the simulation works lists its assumptions.'
          ],
          vi: [
            'Crossdraft là mô hình giảng dạy hai chiều, không phải phần mềm động lực học chất lưu tính toán (CFD) và cũng không phải công cụ kiểm tra tuân thủ quy chuẩn. Nó không mô phỏng khu đất thật, chiều cao công trình, đồ đạc hay hình khối ba chiều của căn phòng. Hãy dùng nó để xây dựng trực giác và so sánh phương án, rồi dùng công cụ chuyên dụng và kỹ sư có chuyên môn cho các quyết định quan trọng. Trang về cách mô phỏng hoạt động liệt kê các giả định.'
          ]
        }
      }
    ]
  },

  'cross-ventilation-basics': {
    slug: 'cross-ventilation-basics',
    title: { en: 'Cross ventilation: how to read a floor plan for airflow', vi: 'Thông gió xuyên phòng: cách đọc mặt bằng về luồng gió' },
    description: {
      en: 'A short guide to cross ventilation in houses and apartments: why openings on opposite sides work, why one-sided rooms stay stale, and what to check in a plan.',
      vi: 'Hướng dẫn ngắn về thông gió xuyên phòng trong nhà ở và căn hộ: vì sao các ô mở ở hai phía đối diện hiệu quả, vì sao phòng chỉ có một phía thoáng bị bí và nên kiểm tra gì trên mặt bằng.'
    },
    sections: [
      {
        h: { en: 'Why air crosses a room', vi: 'Vì sao không khí đi xuyên qua phòng' },
        p: {
          en: [
            'Wind pushes air into openings on the side facing it and draws air out of openings on the other sides. When a room has an opening on the wind side and another on the opposite or a side wall, there is a path for air to cross: this is cross ventilation. It replaces stale indoor air with outdoor air and moves air over the people inside.',
            'The more direct the path and the larger the openings, the more air moves. A path that runs straight from one opening to the facing one flushes quickly but can feel draughty along that line.'
          ],
          vi: [
            'Gió đẩy không khí vào các ô mở ở phía đón gió và hút không khí ra khỏi các ô mở ở những phía khác. Khi phòng có một ô mở ở phía đón gió và một ô mở khác ở tường đối diện hoặc tường bên, không khí có đường để đi xuyên qua: đó là thông gió xuyên phòng. Nó thay không khí tù bên trong bằng không khí bên ngoài và đưa luồng khí lướt qua người trong phòng.',
            'Đường đi càng thẳng và ô mở càng lớn thì càng có nhiều khí di chuyển. Đường chạy thẳng từ ô mở này tới ô mở đối diện làm thoáng rất nhanh nhưng có thể gây cảm giác gió lùa dọc theo đường đó.'
          ]
        }
      },
      {
        h: { en: 'What to check in a plan', vi: 'Nên kiểm tra gì trên mặt bằng' },
        p: { en: ['A quick checklist you can test in Crossdraft:'], vi: ['Danh sách kiểm tra nhanh mà bạn có thể thử trong Crossdraft:'] },
        list: {
          en: [
            'Does every room that matters have openings on at least two different sides? A room with openings on one wall only gets little exchange, because there is no pressure difference to drive air through it.',
            'Do the openings face the prevailing wind, and what happens when the wind changes direction? Run the wind sweep to find out how sensitive the layout is.',
            'Are there rooms whose only openings lead to other rooms? Air must cross the neighbouring room first, so these rooms tend to stay stale.',
            'Is there a long corridor or a deep room where the air has to travel far? Dead zones, where air is almost still, often appear at the far end.',
            'Do neighbouring buildings or walls shelter the windows? A block upwind can cut the flow a great deal.',
            'Would a fan, a light well or a courtyard help? Test one change at a time and compare.'
          ],
          vi: [
            'Mỗi phòng quan trọng có ô mở ở ít nhất hai phía khác nhau không? Phòng chỉ có ô mở trên một bức tường ít được thay khí, vì không có chênh lệch áp suất để đẩy khí qua phòng.',
            'Các ô mở có hướng về gió chủ đạo không, và điều gì xảy ra khi gió đổi hướng? Hãy chạy chức năng quét hướng gió để biết bố cục nhạy với hướng gió đến mức nào.',
            'Có phòng nào mà ô mở chỉ dẫn sang các phòng khác không? Không khí phải đi qua phòng bên cạnh trước, nên những phòng này dễ bị bí.',
            'Có hành lang dài hoặc căn phòng sâu khiến không khí phải đi xa không? Vùng lặng gió, nơi không khí gần như đứng yên, thường xuất hiện ở đầu xa.',
            'Nhà bên cạnh hoặc tường có che chắn cửa sổ không? Một khối nhà đón gió ở phía trước có thể làm giảm dòng khí rất nhiều.',
            'Quạt, giếng trời hay sân trong có giúp ích không? Hãy thử từng thay đổi một và so sánh.'
          ]
        }
      },
      {
        h: { en: 'Plan and section tell different stories', vi: 'Mặt bằng và mặt cắt cho biết những điều khác nhau' },
        p: {
          en: [
            'A plan shows how wind moves sideways through rooms. A section shows the vertical story: warm air rises, so a low opening for cool air and a high opening for warm air can move air even when the wind is calm (the stack effect). Crossdraft has both views. In the section view, heaters create buoyancy; in the plan view they only warm the air that passes by.'
          ],
          vi: [
            'Mặt bằng cho thấy gió đi ngang qua các phòng. Mặt cắt kể câu chuyện theo chiều đứng: khí nóng bay lên, nên một ô mở thấp cho khí mát vào và một ô mở cao cho khí nóng thoát ra có thể làm không khí chuyển động ngay cả khi lặng gió (hiệu ứng ống khói). Crossdraft có cả hai chế độ xem. Ở chế độ mặt cắt, nguồn nhiệt tạo lực nổi; ở chế độ mặt bằng chúng chỉ làm ấm không khí đi ngang qua.'
          ]
        }
      }
    ]
  },

  'how-it-works': {
    slug: 'how-it-works',
    title: { en: 'How the simulation works, and what it cannot tell you', vi: 'Cách mô phỏng hoạt động và những điều nó không cho biết' },
    description: {
      en: 'Crossdraft runs a small 2D stable-fluids solver in your browser. This page explains the method, the numbers it reports, its assumptions and its limits.',
      vi: 'Crossdraft chạy một bộ giải chất lưu ổn định 2D nhỏ trong trình duyệt. Trang này giải thích phương pháp, các con số nó báo cáo, các giả định và giới hạn.'
    },
    sections: [
      {
        h: { en: 'The method in brief', vi: 'Tóm tắt phương pháp' },
        p: {
          en: [
            'The drawing is a grid of cells. Each cell holds a velocity, a pressure and three tracers: fresh air (0 to 1), air age in seconds and temperature rise. Every step the solver applies forces, moves the velocity along itself (semi-Lagrangian advection), removes compression with a pressure solve so that the air behaves as incompressible, then carries the tracers along and mixes them slightly.',
            'This is the "stable fluids" approach of Jos Stam (1999), chosen because it stays stable at any wind speed, which suits a teaching tool. Small eddies are kept alive with vorticity confinement (Fedkiw, Stam and Jensen, 2001). Fans are jets of fixed speed, heaters are cells held above ambient temperature, and screens, plants and curtains are porous cells that let air through but slow it with quadratic drag.'
          ],
          vi: [
            'Bản vẽ là một lưới ô. Mỗi ô lưu vận tốc, áp suất và ba chất đánh dấu: không khí sạch (0 đến 1), tuổi không khí tính bằng giây và độ tăng nhiệt. Mỗi bước, bộ giải áp dụng các lực, đẩy vận tốc theo chính nó (đối lưu bán Lagrange), loại bỏ sự nén bằng một phép giải áp suất để không khí cư xử như không nén được, rồi mang các chất đánh dấu đi theo dòng và trộn nhẹ chúng.',
            'Đây là cách tiếp cận "stable fluids" của Jos Stam (1999), được chọn vì nó ổn định ở mọi tốc độ gió, phù hợp với công cụ giảng dạy. Các xoáy nhỏ được giữ lại bằng lực giữ xoáy (Fedkiw, Stam và Jensen, 2001). Quạt là các tia có tốc độ cố định, nguồn nhiệt là các ô được giữ cao hơn nhiệt độ môi trường, còn bình phong, cây và rèm là các ô xốp cho khí đi qua nhưng làm chậm lại bằng lực cản bậc hai.'
          ]
        }
      },
      {
        h: { en: 'What the numbers mean', vi: 'Các con số có ý nghĩa gì' },
        p: { en: ['For each closed room the app reports:'], vi: ['Với mỗi phòng kín, ứng dụng báo cáo:'] },
        list: {
          en: [
            'Fresh air: the average share of air that has come from outside, from 0% to 100%.',
            'Dead zone: the share of the room whose smoothed air speed is below a threshold, 0.1 m/s by default.',
            'Draught comfort: 100% while the speed stays under 0.3 m/s, falling to 0 at 1.5 m/s.',
            'Air age: how long, on average, the air has been inside.',
            'T90: the time for the room to reach 90% fresh air starting from still, stale air.',
            'Score: 50 × stale air flushed + 30 × (1 − dead zone) + 20 × comfort, out of 100. It is a way to compare two layouts under the same test, not a standard.'
          ],
          vi: [
            'Không khí sạch: tỷ lệ trung bình không khí đến từ bên ngoài, từ 0% đến 100%.',
            'Vùng lặng gió: phần diện tích phòng có tốc độ khí đã làm mượt thấp hơn một ngưỡng, mặc định 0,1 m/s.',
            'Độ dễ chịu về gió lùa: 100% khi tốc độ dưới 0,3 m/s, giảm về 0 ở 1,5 m/s.',
            'Tuổi không khí: trung bình không khí đã ở trong phòng bao lâu.',
            'T90: thời gian để phòng đạt 90% không khí sạch khi bắt đầu từ không khí tù, đứng yên.',
            'Điểm: 50 × phần khí tù được thay + 30 × (1 − vùng lặng gió) + 20 × độ dễ chịu, trên 100. Đây là cách để so sánh hai bố cục trong cùng một bài thử, không phải một tiêu chuẩn.'
          ]
        }
      },
      {
        h: { en: 'Assumptions and limits', vi: 'Giả định và giới hạn' },
        p: { en: ['Read results with these in mind:'], vi: ['Hãy đọc kết quả với những điều sau:'] },
        list: {
          en: [
            'It is two-dimensional. A plan has no ceiling height effects other than a fixed heat conversion; a section has no depth.',
            'The wind is uniform across the board. Real wind changes with street layout, height and season, and the preset winds are typical values for teaching, not site data.',
            'Openings are open gaps. Window sashes, louvres, insect screens and doors that swing are not modelled.',
            'The grid is coarse (0.25 m cells in a plan) and turbulence is represented by a simple mixing term, so small features and exact speeds are not reliable.',
            'Corner cells can show unrealistically high speeds. Treat peak speeds with caution and compare layouts rather than reading single values.',
            'It does not model pollutants, humidity, solar gain, occupants or mechanical systems.'
          ],
          vi: [
            'Mô hình hai chiều. Mặt bằng không có ảnh hưởng của chiều cao trần ngoài một hệ số quy đổi nhiệt cố định; mặt cắt không có chiều sâu.',
            'Gió đồng đều trên toàn bảng. Gió thật thay đổi theo cách bố trí đường phố, độ cao và mùa, còn các hướng gió có sẵn là giá trị điển hình để giảng dạy, không phải số liệu của khu đất.',
            'Các ô mở là khoảng hở trống. Cánh cửa sổ, lá sách, lưới chống côn trùng và cửa mở quay không được mô hình hóa.',
            'Lưới thô (ô 0,25 m trong mặt bằng) và độ rối được biểu diễn bằng một số hạng trộn đơn giản, nên các chi tiết nhỏ và tốc độ chính xác không đáng tin.',
            'Các ô ở góc có thể cho tốc độ cao phi thực tế. Hãy thận trọng với tốc độ đỉnh và so sánh các bố cục thay vì đọc từng giá trị riêng lẻ.',
            'Không mô hình hóa chất ô nhiễm, độ ẩm, bức xạ mặt trời, người sử dụng hay hệ thống cơ khí.'
          ]
        }
      },
      {
        h: { en: 'Open source', vi: 'Mã nguồn mở' },
        p: {
          en: [
            'The code is public on GitHub, including the solver and the tests that check it. If you spot a mistake in the physics or in the text, an issue or pull request is welcome.'
          ],
          vi: [
            'Mã nguồn được công khai trên GitHub, gồm cả bộ giải và các bài kiểm thử. Nếu bạn thấy sai sót trong phần vật lý hoặc trong nội dung, rất hoan nghênh báo lỗi hoặc gửi pull request.'
          ]
        }
      }
    ]
  },

  'feng-shui-airflow': {
    slug: 'feng-shui-airflow',
    title: { en: 'Feng shui and airflow: tradition next to measurement', vi: 'Phong thủy và luồng gió: quan niệm truyền thống đặt cạnh số đo' },
    description: {
      en: 'How Crossdraft treats feng shui (phong thủy): four airflow rules measured on your plan, shown next to what the tradition says, with no luck score.',
      vi: 'Cách Crossdraft xử lý phong thủy: bốn quy tắc về luồng khí được đo trên bản vẽ của bạn, đặt cạnh điều quan niệm truyền thống nói, không chấm điểm vận may.'
    },
    sections: [
      {
        h: { en: 'Why feng shui belongs in an airflow tool', vi: 'Vì sao phong thủy có mặt trong công cụ về luồng gió' },
        p: {
          en: [
            'Feng shui literally means "wind and water", and many of its rules about homes are really about how air enters and moves. Students designing homes in Vietnam and elsewhere in Asia are often asked about these rules by clients and families, so Crossdraft lets them see the airflow behind a rule.',
            'This is a traditional belief, not engineering. Crossdraft does not score luck, wealth or health, and it does not claim that a rule has such effects. It measures air on your plan and shows it next to what the tradition says.'
          ],
          vi: [
            'Phong thủy theo nghĩa đen là "gió và nước", và nhiều quy tắc về nhà ở thực chất nói về cách không khí đi vào và lưu thông. Sinh viên thiết kế nhà ở Việt Nam và nhiều nước châu Á khác thường được gia chủ hỏi về các quy tắc này, nên Crossdraft cho phép họ nhìn thấy luồng khí đằng sau một quy tắc.',
            'Đây là quan niệm truyền thống, không phải kỹ thuật. Crossdraft không chấm điểm vận may, tài lộc hay sức khỏe và không khẳng định quy tắc nào có những tác động đó. Nó đo không khí trên bản vẽ của bạn và đặt cạnh điều quan niệm truyền thống nói.'
          ]
        }
      },
      {
        h: { en: 'The four rules Crossdraft checks', vi: 'Bốn quy tắc Crossdraft kiểm tra' },
        p: {
          en: ['The list is closed on purpose. Each rule is about airflow and is measured on the simulated plan:'],
          vi: ['Danh sách được giữ đóng có chủ đích. Mỗi quy tắc đều về luồng khí và được đo trên mặt bằng mô phỏng:']
        },
        list: {
          en: [
            'Front door aligned with back door or window. Tradition says air entering the front door should gather in the house, not run straight out. Physics: openings facing each other are the best layout for cross ventilation, so the line flushes the room fast, at the cost of a possible draught. Crossdraft reports the air speed along the line and how long air lingers near the entrance.',
            'Entrance buffer. A screen (huyền quan), a shelf or a turn just inside the door. Physics: a buffer slows and spreads the entering jet, which feels calmer, but it can also reduce how far fresh air reaches. In the simulation a screen just inside the entrance shortens how long air lingers there, because it removes eddies beside the incoming jet.',
            'Wind and openings. Tradition speaks of shielding harsh wind and letting a gentle breeze in ("tàng phong tụ khí"). Crossdraft checks which openings face the wind, within 67 degrees of where it comes from.',
            'Stagnant air. Crossdraft flags a room with under 35% fresh air or with more than a quarter of its area almost still.'
          ],
          vi: [
            'Cửa chính thẳng hàng với cửa sau hoặc cửa sổ. Quan niệm truyền thống cho rằng khí vào cửa chính nên tụ lại trong nhà, không nên xuyên thẳng ra ngoài. Vật lý: các ô mở đối diện nhau là bố cục thông gió xuyên phòng tốt nhất, nên đường này làm phòng thoáng nhanh, với cái giá là có thể gió lùa. Crossdraft báo tốc độ khí dọc đường này và thời gian khí lưu lại gần lối vào.',
            'Khoảng đệm lối vào. Bình phong (huyền quan), kệ hoặc chỗ rẽ ngay sau cửa. Vật lý: khoảng đệm làm luồng gió vào chậm và tỏa ra nên dịu hơn, nhưng cũng có thể làm gió sạch đi được ít xa hơn. Trong mô phỏng, bình phong ngay sau lối vào rút ngắn thời gian khí lưu lại ở đó vì nó loại bỏ các xoáy cạnh luồng gió vào.',
            'Gió và các ô mở. Quan niệm truyền thống nói về việc chắn gió dữ và đón gió nhẹ ("tàng phong tụ khí"). Crossdraft kiểm tra những ô mở nào hướng về gió, lệch không quá 67 độ so với hướng gió thổi đến.',
            'Không khí tù đọng. Crossdraft đánh dấu phòng có dưới 35% không khí sạch hoặc có hơn một phần tư diện tích gần như lặng gió.'
          ]
        }
      },
      {
        h: { en: 'What is deliberately not checked', vi: 'Những gì cố ý không kiểm tra' },
        p: {
          en: [
            'Stairs facing the door, room placement, furniture, compass directions and house size are not checked, because they are not questions about airflow that the simulation can answer. The sources for the traditional statements are practitioner articles, not science, and are linked from the app so you can read them yourself.'
          ],
          vi: [
            'Cầu thang đối diện cửa, vị trí phòng, đồ đạc, hướng la bàn và kích thước nhà không được kiểm tra, vì đó không phải những câu hỏi về luồng khí mà mô phỏng có thể trả lời. Nguồn của các nhận định truyền thống là bài viết của người hành nghề, không phải khoa học, và có liên kết trong ứng dụng để bạn tự đọc.'
          ]
        }
      }
    ]
  }
};

export const FAQS: Faq[] = [
  {
    q: { en: 'Is Crossdraft real CFD?', vi: 'Crossdraft có phải CFD thật không?' },
    a: {
      en: 'No. It is a small two-dimensional teaching model that shows how air tends to move and lets you compare layouts. It is not validated against measurements and should not be used to certify a design.',
      vi: 'Không. Đây là mô hình giảng dạy hai chiều nhỏ cho thấy không khí có xu hướng di chuyển thế nào và cho phép so sánh các bố cục. Nó chưa được kiểm chứng với số đo thực tế và không nên dùng để chứng nhận một thiết kế.'
    }
  },
  {
    q: { en: 'Is it free, and do I need an account?', vi: 'Có miễn phí không, và có cần tài khoản không?' },
    a: {
      en: 'It is free and needs no account. The simulation runs in your browser, so your drawings are not uploaded. They are kept in your browser storage and in any share link or layout code you copy.',
      vi: 'Miễn phí và không cần tài khoản. Mô phỏng chạy trong trình duyệt nên bản vẽ của bạn không bị tải lên. Chúng được lưu trong bộ nhớ trình duyệt và trong mọi đường dẫn chia sẻ hoặc mã bản vẽ bạn sao chép.'
    }
  },
  {
    q: { en: 'How do I read the results for a room?', vi: 'Làm sao đọc kết quả của một phòng?' },
    a: {
      en: 'Open the Results tab. It shows the share of stale air flushed out, the dead-zone area, draught comfort, mean air age and the time to reach 90% fresh air, plus a score out of 100 for comparing layouts. Wait for the status to say settled before you trust the numbers.',
      vi: 'Mở thẻ Kết quả. Thẻ này cho biết phần không khí tù được thay mới, diện tích vùng lặng gió, độ dễ chịu về gió lùa, tuổi không khí trung bình và thời gian đạt 90% không khí sạch, cùng điểm trên 100 để so sánh bố cục. Hãy đợi trạng thái "đã ổn định" rồi mới tin các con số.'
    }
  },
  {
    q: { en: 'How do I compare two designs?', vi: 'Làm sao so sánh hai phương án?' },
    a: {
      en: 'Press Test → A on the first design, change the drawing, then press Test → B. Both tests start from still, stale air and run for the same length, so the table shows a fair side-by-side comparison. You can also duplicate a board and edit the copy.',
      vi: 'Nhấn Test → A với phương án đầu, sửa bản vẽ, rồi nhấn Test → B. Cả hai bài thử đều bắt đầu từ không khí tù, đứng yên và chạy cùng độ dài, nên bảng cho một so sánh công bằng. Bạn cũng có thể nhân bản một bảng rồi sửa bản sao.'
    }
  },
  {
    q: { en: 'What wind should I use?', vi: 'Nên dùng gió thế nào?' },
    a: {
      en: 'Use the dial and sliders, or pick a typical wind such as the north Vietnam winter monsoon. The presets are typical values for teaching, not data for a site. Run the wind sweep to see how a layout does from every direction.',
      vi: 'Dùng la bàn và thanh trượt, hoặc chọn một hướng gió điển hình như gió mùa đông bắc ở miền Bắc Việt Nam. Các lựa chọn có sẵn là giá trị điển hình để giảng dạy, không phải số liệu của một khu đất. Hãy chạy quét hướng gió để xem bố cục ra sao với mọi hướng.'
    }
  },
  {
    q: { en: 'What is a dead zone?', vi: 'Vùng lặng gió là gì?' },
    a: {
      en: 'A dead zone is part of a room where the smoothed air speed stays below a threshold, 0.1 m/s by default. Air there changes slowly, so it tends to feel stuffy. Crossdraft hatches these areas on the plan.',
      vi: 'Vùng lặng gió là phần của phòng nơi tốc độ khí đã làm mượt luôn thấp hơn một ngưỡng, mặc định 0,1 m/s. Không khí ở đó đổi chậm nên dễ gây cảm giác bí. Crossdraft tô gạch các vùng này trên mặt bằng.'
    }
  },
  {
    q: { en: 'Can I put several views of one building on the canvas?', vi: 'Có thể đặt nhiều góc nhìn của một công trình lên canvas không?' },
    a: {
      en: 'Yes. Add boards with the Board tool or the Boards tab. Each board has its own drawing, wind direction and view (plan or section). The selected board runs at full speed and the others tick slowly. You can duplicate a board to try a variant.',
      vi: 'Có. Thêm bảng bằng công cụ Bảng hoặc thẻ Bảng. Mỗi bảng có bản vẽ, hướng gió và chế độ xem (mặt bằng hoặc mặt cắt) riêng. Bảng đang chọn chạy hết tốc độ, các bảng khác chạy chậm. Bạn có thể nhân bản một bảng để thử phương án khác.'
    }
  },
  {
    q: { en: 'Does Crossdraft tell me if a house has good feng shui?', vi: 'Crossdraft có cho biết nhà có phong thủy tốt không?' },
    a: {
      en: 'No. It checks four airflow rules and shows what the tradition says next to what the simulation measures. It does not score luck, wealth or health. Feng shui here is a traditional belief, not engineering.',
      vi: 'Không. Nó kiểm tra bốn quy tắc về luồng khí và đặt điều quan niệm truyền thống nói cạnh điều mô phỏng đo được. Nó không chấm điểm vận may, tài lộc hay sức khỏe. Phong thủy ở đây là quan niệm truyền thống, không phải kỹ thuật.'
    }
  },
  {
    q: { en: 'How do I share or save my work?', vi: 'Làm sao chia sẻ hoặc lưu bản vẽ?' },
    a: {
      en: 'Use Share link to copy a link that carries the whole project: every board, its wind, and your notes. Layouts also have a code you can export and import in the Layouts tab. The app saves your project in your browser automatically.',
      vi: 'Dùng Chia sẻ liên kết để sao chép đường dẫn chứa cả dự án: mọi bảng, hướng gió của chúng và các ghi chú. Bản vẽ cũng có mã để xuất và nhập ở thẻ Bản vẽ. Ứng dụng tự lưu dự án trong trình duyệt của bạn.'
    }
  },
  {
    q: { en: 'What languages does it support?', vi: 'Hỗ trợ những ngôn ngữ nào?' },
    a: {
      en: 'English and Vietnamese. The Vietnamese text is still waiting for review by a native speaker, so corrections are welcome.',
      vi: 'Tiếng Anh và tiếng Việt. Bản tiếng Việt vẫn đang chờ người bản ngữ rà soát, nên rất hoan nghênh góp ý chỉnh sửa.'
    }
  }
];

export const SECTIONS_UI = {
  home: { en: 'Open the app', vi: 'Mở ứng dụng' },
  guide: { en: 'Guide', vi: 'Hướng dẫn' },
  examplesNav: { en: 'Examples', vi: 'Ví dụ' },
  guideTitle: { en: 'Crossdraft guide: airflow in floor plans', vi: 'Hướng dẫn Crossdraft: luồng khí trong mặt bằng' },
  guideDescription: {
    en: 'Plain-language guides to cross ventilation, how the Crossdraft simulation works, feng shui and airflow, example layouts and answers to common questions.',
    vi: 'Các bài hướng dẫn dễ hiểu về thông gió xuyên phòng, cách mô phỏng của Crossdraft hoạt động, phong thủy và luồng khí, các bản vẽ ví dụ và giải đáp thắc mắc thường gặp.'
  },
  updated: { en: 'Last updated', vi: 'Cập nhật lần cuối' },
  related: { en: 'More in the guide', vi: 'Xem thêm trong hướng dẫn' },
  footerNote: {
    en: 'Crossdraft is an indicative 2D teaching model, not CFD. Feng shui content is traditional belief, not engineering.',
    vi: 'Crossdraft là mô hình giảng dạy 2D mang tính tham khảo, không phải CFD. Nội dung phong thủy là quan niệm truyền thống, không phải kỹ thuật.'
  },
  switchTo: { en: 'Tiếng Việt', vi: 'English' },
  examplesIntro: {
    en: 'Each example opens from the Layouts tab of the app. The note says what to look for.',
    vi: 'Mỗi ví dụ mở được từ thẻ Bản vẽ trong ứng dụng. Ghi chú cho biết nên để ý điều gì.'
  },
  plan: { en: 'Plan examples', vi: 'Ví dụ mặt bằng' },
  section: { en: 'Section examples', vi: 'Ví dụ mặt cắt' },
  faqTitle: { en: 'Frequently asked questions', vi: 'Câu hỏi thường gặp' }
} satisfies Record<string, L>;

const N = PRESETS.plan.length + PRESETS.section.length;
export const META: Record<Slug, { title: L; description: L }> = {
  'what-is-crossdraft': ARTICLES['what-is-crossdraft'],
  'cross-ventilation-basics': ARTICLES['cross-ventilation-basics'],
  'how-it-works': ARTICLES['how-it-works'],
  'feng-shui-airflow': ARTICLES['feng-shui-airflow'],
  examples: {
    title: { en: 'Example layouts for studying airflow', vi: 'Các bản vẽ ví dụ để nghiên cứu luồng khí' },
    description: {
      en: `${N} example plans and sections for Crossdraft, from a cross-ventilated studio to a street canyon, each with a note on what to look for in the wind flow.`,
      vi: `${N} mặt bằng và mặt cắt ví dụ cho Crossdraft, từ studio thông gió xuyên phòng đến hẻm phố, mỗi ví dụ có ghi chú nên để ý gì trong luồng gió.`
    }
  },
  faq: {
    title: { en: 'Frequently asked questions', vi: 'Câu hỏi thường gặp' },
    description: {
      en: 'Answers about Crossdraft: whether it is CFD, how to read the results, how to compare designs, wind presets, feng shui, sharing and languages.',
      vi: 'Giải đáp về Crossdraft: có phải CFD không, cách đọc kết quả, cách so sánh phương án, các hướng gió có sẵn, phong thủy, chia sẻ và ngôn ngữ.'
    }
  }
};

/** Example layouts for the examples page, named and described in the page's language. */
export function exampleList(lang: SiteLang): { mode: 'plan' | 'section'; id: string; name: string; note: string }[] {
  return (['plan', 'section'] as const).flatMap((mode) =>
    PRESETS[mode].map((p) => ({
      mode,
      id: p.id,
      name: translate(lang, `preset.${p.id}.name`),
      note: translate(lang, `preset.${p.id}.note`)
    }))
  );
}
