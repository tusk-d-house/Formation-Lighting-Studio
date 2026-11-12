import { FormationItem as Formation, Performer } from '../types';
import { DEFAULT_DANCER_COLOR } from '../store/useFormationStore';

/**
 * ダンサーの色が「グレー（不参加）」かどうかを判定する。
 * プリセットのグレー (#64748b) はもちろん、カラーピッカーで選ばれた無彩色（彩度が低いグレー系）もグレーとして扱う。
 */
export function isDancerGrayColor(hexColor?: string): boolean {
    const raw = (hexColor || DEFAULT_DANCER_COLOR).trim().toLowerCase();
    if (
        raw === '#64748b' ||
        raw === '#6b7280' ||
        raw === '#71717a' ||
        raw === '#737373' ||
        raw === '#78716c' ||
        raw === '#94a3b8' ||
        raw === '#475569'
    ) {
        return true;
    }

    const match = raw.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!match) return false;

    const r = parseInt(match[1], 16) / 255;
    const g = parseInt(match[2], 16) / 255;
    const b = parseInt(match[3], 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;

    if (d === 0) {
        return true; // 完全な無彩色 (黒・グレー・白)
    }

    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    // 彩度が22%以下の落ち着いた無彩色・スレートグレー系はグレーとみなす
    return s <= 0.22;
}

/**
 * フォーメーション f にダンサー p が出演しているかどうか（グレー以外の色か）を返す
 */
export function isDancerParticipating(formation: Formation, performer: Performer): boolean {
    const color = formation.colors?.[performer.id] || performer.color || DEFAULT_DANCER_COLOR;
    return !isDancerGrayColor(color);
}

/**
 * 0-indexed の列番号を Excel の列名 (A, B, C, ..., Z, AA, AB...) に変換
 */
function toExcelCol(colIndex: number): string {
    let idx = colIndex;
    let colName = '';
    while (idx >= 0) {
        colName = String.fromCharCode(65 + (idx % 26)) + colName;
        idx = Math.floor(idx / 26) - 1;
    }
    return colName;
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ============================================================================
// Pure JS CRC32 & Uncompressed ZIP (STORE) builder for standard .xlsx
// ============================================================================
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
        c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
    name: string;
    data: Uint8Array;
}

function buildZipArchive(entries: ZipEntry[]): Uint8Array {
    const encoder = new TextEncoder();
    const localHeaders: Uint8Array[] = [];
    const centralHeaders: Uint8Array[] = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const dataBytes = entry.data;
        const crc = crc32(dataBytes);
        const size = dataBytes.length;

        // Local file header (30 bytes + name)
        const localHeader = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(localHeader.buffer);
        lv.setUint32(0, 0x04034b50, true); // signature
        lv.setUint16(4, 20, true); // version needed (2.0)
        lv.setUint16(6, 0x0800, true); // flags: UTF-8 filename
        lv.setUint16(8, 0, true); // compression: STORE (0)
        lv.setUint16(10, 0, true); // mod time
        lv.setUint16(12, 0x21, true); // mod date
        lv.setUint32(14, crc, true); // crc32
        lv.setUint32(18, size, true); // compressed size
        lv.setUint32(22, size, true); // uncompressed size
        lv.setUint16(26, nameBytes.length, true); // file name length
        lv.setUint16(28, 0, true); // extra field length
        localHeader.set(nameBytes, 30);

        localHeaders.push(localHeader, dataBytes);

        // Central directory file header (46 bytes + name)
        const centralHeader = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(centralHeader.buffer);
        cv.setUint32(0, 0x02014b50, true); // signature
        cv.setUint16(4, 20, true); // version made by
        cv.setUint16(6, 20, true); // version needed
        cv.setUint16(8, 0x0800, true); // flags: UTF-8
        cv.setUint16(10, 0, true); // compression: STORE
        cv.setUint16(12, 0, true); // mod time
        cv.setUint16(14, 0x21, true); // mod date
        cv.setUint32(16, crc, true); // crc32
        cv.setUint32(20, size, true); // compressed size
        cv.setUint32(24, size, true); // uncompressed size
        cv.setUint16(28, nameBytes.length, true); // file name length
        cv.setUint16(30, 0, true); // extra field length
        cv.setUint16(32, 0, true); // comment length
        cv.setUint16(34, 0, true); // disk number
        cv.setUint16(36, 0, true); // internal attrs
        cv.setUint32(38, 0, true); // external attrs
        cv.setUint32(42, offset, true); // relative offset of local header
        centralHeader.set(nameBytes, 46);

        centralHeaders.push(centralHeader);
        offset += localHeader.length + dataBytes.length;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const ch of centralHeaders) {
        centralDirSize += ch.length;
    }

    // End of central directory record (22 bytes)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralDirSize, true);
    ev.setUint32(16, centralDirOffset, true);
    ev.setUint16(20, 0, true);

    const totalSize = centralDirOffset + centralDirSize + eocd.length;
    const output = new Uint8Array(totalSize);
    let pos = 0;
    for (const chunk of localHeaders) {
        output.set(chunk, pos);
        pos += chunk.length;
    }
    for (const ch of centralHeaders) {
        output.set(ch, pos);
        pos += ch.length;
    }
    output.set(eocd, pos);

    return output;
}

/**
 * 出演表の Excel (.xlsx) バイナリを生成する
 *
 * 表の構成:
 * - 1行目: A1="ダンサー名", B1="出ているカウント数", C1以降=各フォーメーション名
 * - 2行目: A2="カウント数", B2=SUM(C2:...), C2以降=フォーメーションのカウント数入力欄（空欄）
 * - 3〜(N+2)行目: A列=ダンサー名, B列=SUMIF(C{r}:{lastCol}{r}, TRUE, $C$2:$${lastCol}$2), C列以降=セル内チェックボックス (TRUE / FALSE)
 * - (N+3)行目（最下行）: A列="合計人数", B列="", C列以降=COUNTIF({col}3:{col}{N+2}, TRUE)
 */
export function generateAttendanceXlsxBytes(
    performers: Performer[],
    formations: Formation[]
): Uint8Array {
    const encoder = new TextEncoder();
    const numPerformers = performers.length;
    const numFormations = formations.length;
    const lastFormationCol = numFormations > 0 ? toExcelCol(2 + numFormations - 1) : 'C';

    const rowsXml: string[] = [];

    // -------------------------------------------------------------------------
    // Row 1: Header (1: フォーメーション名)
    // Style s="1" -> Dark header style
    // -------------------------------------------------------------------------
    {
        const cells: string[] = [];
        cells.push(`<c r="A1" t="inlineStr" s="1"><is><t>ダンサー名</t></is></c>`);
        cells.push(`<c r="B1" t="inlineStr" s="1"><is><t>出ているカウント数</t></is></c>`);
        formations.forEach((f, idx) => {
            const col = toExcelCol(2 + idx);
            const label = f.name || `#${idx + 1}`;
            cells.push(`<c r="${col}1" t="inlineStr" s="1"><is><t>${escapeXml(label)}</t></is></c>`);
        });
        rowsXml.push(`<row r="1" ht="24" customHeight="1">${cells.join('')}</row>`);
    }

    // -------------------------------------------------------------------------
    // Row 2: Count Input Row (2: フォーメーションのカウント数入力欄)
    // Style s="2" -> Label / formula cell for row 2
    // Style s="3" -> Editable yellow-tinted input cell for C2..
    // -------------------------------------------------------------------------
    {
        const cells: string[] = [];
        cells.push(`<c r="A2" t="inlineStr" s="2"><is><t>カウント数</t></is></c>`);
        if (numFormations > 0) {
            cells.push(`<c r="B2" s="2"><f>SUM(C2:${lastFormationCol}2)</f><v>0</v></c>`);
        } else {
            cells.push(`<c r="B2" s="2"><v>0</v></c>`);
        }
        formations.forEach((_, idx) => {
            const col = toExcelCol(2 + idx);
            cells.push(`<c r="${col}2" s="3"/>`);
        });
        rowsXml.push(`<row r="2" ht="22" customHeight="1">${cells.join('')}</row>`);
    }

    // -------------------------------------------------------------------------
    // Rows 3 .. N+2: Performers
    // Style s="4" -> Dancer name cell (left aligned, bordered)
    // Style s="5" -> Dancer total count formula cell (center, bold, bordered)
    // Style s="6" -> TRUE checkbox cell (in-cell Checkbox via xfComplement + light green tint)
    // Style s="7" -> FALSE checkbox cell (in-cell Checkbox via xfComplement + muted gray)
    // -------------------------------------------------------------------------
    performers.forEach((performer, pIdx) => {
        const rowNum = 3 + pIdx;
        const cells: string[] = [];

        cells.push(`<c r="A${rowNum}" t="inlineStr" s="4"><is><t>${escapeXml(performer.name)}</t></is></c>`);

        if (numFormations > 0) {
            const sumIfFormula = `SUMIF(C${rowNum}:${lastFormationCol}${rowNum},TRUE,$C$2:$${lastFormationCol}$2)`;
            cells.push(`<c r="B${rowNum}" s="5"><f>${sumIfFormula}</f><v>0</v></c>`);
        } else {
            cells.push(`<c r="B${rowNum}" s="5"><v>0</v></c>`);
        }

        formations.forEach((formation, fIdx) => {
            const col = toExcelCol(2 + fIdx);
            const participating = isDancerParticipating(formation, performer);
            const boolVal = participating ? '1' : '0';
            const styleIdx = participating ? '6' : '7';
            cells.push(`<c r="${col}${rowNum}" t="b" s="${styleIdx}"><v>${boolVal}</v></c>`);
        });

        rowsXml.push(`<row r="${rowNum}" ht="20" customHeight="1">${cells.join('')}</row>`);
    });

    // -------------------------------------------------------------------------
    // Row N+3: Bottom Total Row (一番下: そのフォーメーションに出ている合計人数)
    // Style s="8" -> Summary footer style
    // -------------------------------------------------------------------------
    const totalRowNum = 3 + numPerformers;
    {
        const cells: string[] = [];
        cells.push(`<c r="A${totalRowNum}" t="inlineStr" s="8"><is><t>合計人数</t></is></c>`);
        cells.push(`<c r="B${totalRowNum}" t="inlineStr" s="8"><is><t></t></is></c>`);

        formations.forEach((formation, fIdx) => {
            const col = toExcelCol(2 + fIdx);
            const activeCount = performers.reduce(
                (acc, p) => acc + (isDancerParticipating(formation, p) ? 1 : 0),
                0
            );
            if (numPerformers > 0) {
                const countIfFormula = `COUNTIF(${col}3:${col}${2 + numPerformers},TRUE)`;
                cells.push(`<c r="${col}${totalRowNum}" s="8"><f>${countIfFormula}</f><v>${activeCount}</v></c>`);
            } else {
                cells.push(`<c r="${col}${totalRowNum}" s="8"><v>0</v></c>`);
            }
        });

        rowsXml.push(`<row r="${totalRowNum}" ht="24" customHeight="1">${cells.join('')}</row>`);
    }

    // Column widths
    const colsXmlParts: string[] = [
        `<col min="1" max="1" width="18" customWidth="1"/>`,
        `<col min="2" max="2" width="20" customWidth="1"/>`,
    ];
    if (numFormations > 0) {
        colsXmlParts.push(`<col min="3" max="${2 + numFormations}" width="14" customWidth="1"/>`);
    }

    const lastCellRef = `${toExcelCol(Math.max(1, 1 + numFormations))}${totalRowNum}`;

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCellRef}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane xSplit="2" ySplit="2" topLeftCell="C3" activePane="bottomRight" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXmlParts.join('')}</cols>
  <sheetData>${rowsXml.join('')}</sheetData>
</worksheet>`;

    // Styles with native Excel In-Cell Checkbox extension (xfComplement i="0") on s="6" and s="7"
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xfpb="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag">
  <fonts count="6">
    <font><sz val="11"/><color rgb="FF1E293B"/><name val="Yu Gothic UI"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Yu Gothic UI"/></font>
    <font><b/><sz val="11"/><color rgb="FF1E293B"/><name val="Yu Gothic UI"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F766E"/><name val="Yu Gothic UI"/></font>
    <font><sz val="11"/><color rgb="FF94A3B8"/><name val="Yu Gothic UI"/></font>
    <font><b/><sz val="11"/><color rgb="FF1E3A8A"/><name val="Yu Gothic UI"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF9C3"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFCCFBF1"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="medium"><color rgb="FF475569"/></top>
      <bottom style="double"><color rgb="FF475569"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
      <extLst>
        <ext uri="{C7286773-470A-42A8-94C5-96B5CB345126}">
          <xfpb:xfComplement i="0"/>
        </ext>
      </extLst>
    </xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
      <extLst>
        <ext uri="{C7286773-470A-42A8-94C5-96B5CB345126}">
          <xfpb:xfComplement i="0"/>
        </ext>
      </extLst>
    </xf>
    <xf numFmtId="0" fontId="5" fillId="6" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;

    // FeaturePropertyBag defining native Excel in-cell Checkbox control
    const featurePropertyBagXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<FeaturePropertyBags xmlns="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag">
  <bag type="Checkbox"/>
  <bag type="XFControls">
    <bagId k="CellControl">0</bagId>
  </bag>
  <bag type="XFComplement">
    <bagId k="XFControls">1</bagId>
  </bag>
  <bag type="XFComplements" extRef="XFComplementsMapperExtRef">
    <a k="MappedFeaturePropertyBags">
      <bagId>2</bagId>
    </a>
  </bag>
</FeaturePropertyBags>`;

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="出演表" sheetId="1" r:id="rId1"/>
  </sheets>
  <calcPr calcId="171027" fullCalcOnLoad="1"/>
</workbook>`;

    const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.microsoft.com/office/2022/11/relationships/FeaturePropertyBag" Target="featurePropertyBag/featurePropertyBag.xml"/>
</Relationships>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/featurePropertyBag/featurePropertyBag.xml" ContentType="application/vnd.ms-excel.featurepropertybag+xml"/>
</Types>`;

    return buildZipArchive([
        { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
        { name: '_rels/.rels', data: encoder.encode(rootRelsXml) },
        { name: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
        { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) },
        { name: 'xl/styles.xml', data: encoder.encode(stylesXml) },
        { name: 'xl/featurePropertyBag/featurePropertyBag.xml', data: encoder.encode(featurePropertyBagXml) },
        { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml) },
    ]);
}

/**
 * 出演表を Excel (.xlsx) ファイルとしてダウンロードする
 */
export function downloadAttendanceXlsx(
    projectName: string,
    performers: Performer[],
    formations: Formation[]
): void {
    const xlsxBytes = generateAttendanceXlsxBytes(performers, formations);
    const blob = new Blob([xlsxBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const safeName = (projectName || 'FormationStudio').replace(/[\\/:*?"<>|]/g, '_');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_出演表.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
