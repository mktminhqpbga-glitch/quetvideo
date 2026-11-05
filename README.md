# QuetVideo 0.1.1

**0.1.1 · Làm đẹp theo giao diện LibTV demo:** header 1 hàng không gãy dòng, huy hiệu Song Thập Nhất và avatar PM, thẻ node có icon, huy hiệu kích thước 2048×1152 / 1280×720 và huy hiệu AI tạo, thẻ model có huy hiệu loại màu, nút pill và bóng mềm. Bố cục Grid giữ nguyên, không chồng chéo panel.

Canvas tao video theo luong node, giao dien kieu LibTV, thu vien model kieu Civitai.
Ban nay la ban demo chay duoc, viet don gian, moi phan tach rieng, khong chong cheo giao dien.

## Cai gi lay tu dau, cai gi khong copy

- **Tu app-mooz (chi doc, khong sua repo do):** luong lam viec du an -> canvas graph -> node -> hang doi -> ket qua -> thu vien.
  App-mooz hien tai la Electron, main `desktop/main.cjs`, build Windows/macOS/Linux bang electron-builder.
  QuetVideo dung lai kieu kien truc do, nhung viet lai code moi, don gian hon, khong copy code cua app-mooz.
- **Tu Civitai (chi tham khao y tuong):** thu vien model co ten, loai (Checkpoint, LoRA, Video), model goc,
  tu khoa kich hoat, mo ta va prompt mau. QuetVideo chi co danh muc mau tai cho trong `renderer/data/models.json`,
  khong tai model that, khong copy model hay anh cua Civitai, khong goi API Civitai.
- **Tu demo LibTV canvas da lam truoc do:** header, hang nut demo, canvas cham mo, node anh/video,
  panel prompt, diem demo, hang doi mo phong. Trong ban nay, cac panel dat theo Grid, khong noi len nhau.

## Cau truc, moi file 1 viec, ghi chu o dau file

```
package.json            - lenh chay va build
desktop/main.cjs        - chi mo cua so Electron
server.js               - chi phuc vu ban web, khong can cai goi ngoai
renderer/index.html     - bo cuc Grid: header / demo-bar / left+canvas+right / status
renderer/styles.css     - chi dinh dang
renderer/app.js         - chi noi cac module va gan nut bam
renderer/modules/state.js   - du lieu du an: node, day noi
renderer/modules/nodes.js   - loai node va diem demo
renderer/modules/canvas.js  - pan, zoom, keo node, ve day noi, fit-view
renderer/modules/library.js - doc danh muc model mau
renderer/modules/queue.js   - hang doi mo phong, cho de thay bang API AI that sau nay
renderer/modules/storage.js - luu/tai du an JSON
renderer/modules/export.js  - xuat tom tat luong
renderer/data/models.json   - danh muc model mau
renderer/data/prompts.json  - kho prompt khoa nhan vat va khoa san pham
tests/                  - test logic thuan, khong can trinh duyet
```

## Chay

Web (khong can Electron):

```sh
node server.js
# mo http://localhost:5173
```

Desktop:

```sh
npm install
npm start
```

Test logic:

```sh
npm test
```

## Build Windows, macOS, Web

Web thi khong can build: chi can copy thu muc `renderer/` len bat ky may chu tinh nao, hoac chay `node server.js`.

Desktop, can cai Electron truoc (`npm install`), roi:

```sh
npm run dist:win    # Windows, ra file cai dat NSIS trong dist/
npm run dist:mac    # macOS, ra DMG/ZIP trong dist/
npm run dist:linux  # Linux, ra AppImage trong dist/
```

Luu y that: build macOS tot nhat chay tren may Mac, build Windows tot nhat chay tren Windows hoac co cong cu ky so.
Tren may Linux nay chi kiem tra duoc ban web va test logic, khong the chay thu file .exe hay .dmg.

## Gioi han ro rang, khong gia vo

- Nut Tao trong ban nay chi chay mo phong: hien tien trinh, tru diem demo, ghi ket qua mau vao node.
  Muon co anh/video that, phai thay `renderer/modules/queue.js` bang goi API AI that, kem API key rieng,
  he thong diem that va kho luu tru that. Khong co API key nao trong repo nay.
- Nut Hoi vien, Chia se chi la mo phong giao dien, khong thanh toan that.
- Khong co model, anh hay nhan vat that cua LibTV hay Civitai trong repo nay.
- Du an luu o localStorage cua trinh duyet, chua dong bo len may chu.
